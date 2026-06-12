import type { Database as BunDatabase } from "bun:sqlite"
import type { Kysely } from "kysely"
import type { BunSqliteDialect } from "kysely-bun-sqlite"
import Path from "node:path"
import type { DB } from "./generated/kysely"

let DatabaseCtor: typeof BunDatabase | undefined
let databaseImportError: unknown

let KyselyCtor: typeof Kysely | undefined
let kyselyImportError: unknown

let BunSqliteDialectCtor: typeof BunSqliteDialect | undefined
let bunSqliteImportError: unknown

let dbClientSingleton: Kysely<DB> | undefined

if (process.env.WINTERSPEC_CODEGEN !== "true") {
  try {
    const sqliteModule = await import("bun:sqlite")
    DatabaseCtor = sqliteModule.Database
  } catch (err) {
    databaseImportError = err
  }

  try {
    const kyselyModule = await import("kysely")
    KyselyCtor = kyselyModule.Kysely
  } catch (err) {
    kyselyImportError = err
  }

  try {
    const bunSqliteModule = await import("kysely-bun-sqlite")
    BunSqliteDialectCtor = bunSqliteModule.BunSqliteDialect
  } catch (err) {
    bunSqliteImportError = err
  }
}

const getDatabaseCtor = (): typeof BunDatabase => {
  if (!DatabaseCtor) {
    throw databaseImportError instanceof Error
      ? databaseImportError
      : new Error("bun:sqlite is not available in this environment")
  }
  return DatabaseCtor
}

const DEFAULT_DB_PATH = Path.join(import.meta.dir, "../../db.sqlite3")

const hasObject = (
  db: BunDatabase,
  objectType: "table" | "view" | "index",
  name: string,
) => {
  return (
    db
      .query(
        `SELECT 1 FROM sqlite_master WHERE type = '${objectType}' AND name = '${name}' LIMIT 1`,
      )
      .get() != null
  )
}

const bootstrapCompatibilitySchema = (db: BunDatabase) => {
  if (
    hasObject(db, "table", "components") &&
    hasObject(db, "table", "categories") &&
    hasObject(db, "table", "manufacturers") &&
    hasObject(db, "view", "v_components")
  ) {
    return
  }

  if (!hasObject(db, "table", "jlc_components")) {
    throw new Error("Missing jlc_components source table")
  }

  if (!hasObject(db, "table", "manufacturers")) {
    db.exec(`
      CREATE TABLE manufacturers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      INSERT INTO manufacturers (name)
      SELECT DISTINCT manufacturer
      FROM jlc_components
      ORDER BY manufacturer COLLATE NOCASE;
    `)
  }

  if (!hasObject(db, "table", "categories")) {
    db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL
      );

      CREATE UNIQUE INDEX idx_categories_category_subcategory
        ON categories(category, subcategory);

      INSERT INTO categories (category, subcategory)
      SELECT DISTINCT category, subcategory
      FROM jlc_components
      ORDER BY category COLLATE NOCASE, subcategory COLLATE NOCASE;
    `)
  }

  db.exec(`
    DROP VIEW IF EXISTS components;
    DROP TABLE IF EXISTS components;
    CREATE VIEW components AS
    SELECT
      j.lcsc,
      CASE WHEN lower(coalesce(j.library_type, '')) = 'base' THEN 1 ELSE 0 END AS basic,
      c.id AS category_id,
      j.datasheet,
      j.description,
      json_object(
        'manufacturer', json_object('name', j.manufacturer),
        'title', j.description,
        'mpn', j.mfr,
        'attributes', CASE
          WHEN json_valid(j.attributes) THEN json(j.attributes)
          ELSE json_object()
        END
      ) AS extra,
      0 AS flag,
      j.joints,
      j.last_on_stock,
      j.fetched_at AS last_update,
      m.id AS manufacturer_id,
      j.mfr,
      j.package,
      j.preferred,
      j.price,
      j.stock
    FROM jlc_components j
    INNER JOIN categories c
      ON c.category = j.category AND c.subcategory = j.subcategory
    INNER JOIN manufacturers m
      ON m.name = j.manufacturer;
  `)

  db.exec(`
    DROP VIEW IF EXISTS v_components;
    CREATE VIEW v_components AS
    SELECT
      components.*,
      categories.category,
      categories.subcategory,
      manufacturers.name AS manufacturer
    FROM components
    INNER JOIN categories ON categories.id = components.category_id
    INNER JOIN manufacturers ON manufacturers.id = components.manufacturer_id;
  `)

  if (!hasObject(db, "index", "idx_jlc_components_stock")) {
    db.exec(`
      CREATE INDEX idx_jlc_components_stock
        ON jlc_components(stock DESC);
    `)
  }

  if (!hasObject(db, "table", "microphones")) {
    db.exec(`
      CREATE TABLE microphones AS
      SELECT
        lcsc,
        mfr,
        package,
        description,
        stock,
        price,
        CASE
          WHEN json_valid(price) THEN CAST(json_extract(price, '$[0].price') AS REAL)
          ELSE NULL
        END AS price1,
        subcategory
      FROM jlc_components
      WHERE subcategory IN ('Microphones', 'MEMS Microphones')
        AND stock > 0;

      CREATE INDEX idx_microphones_package ON microphones(package);
      CREATE INDEX idx_microphones_subcategory ON microphones(subcategory);
      CREATE INDEX idx_microphones_stock ON microphones(stock DESC);
    `)
  }

  if (!hasObject(db, "table", "components_fts")) {
    db.exec(`
      CREATE VIRTUAL TABLE components_fts USING fts5(
        mfr,
        description,
        lcsc,
        mfr_chars
      );
    `)
  }

  const ftsCount = db
    .query(`SELECT COUNT(*) AS count FROM components_fts`)
    .get() as { count?: number } | null

  if (!ftsCount || ftsCount.count === 0) {
    db.exec(`
      INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
      SELECT
        lcsc,
        LOWER(mfr),
        LOWER(description),
        LOWER(lcsc),
        REPLACE(LOWER(mfr), '', ' ')
      FROM jlc_components;
    `)
  }
}

export const getResolvedDbPath = (): string => {
  const configuredPath = process.env.JLCSEARCH_DB_PATH?.trim()
  if (!configuredPath) return DEFAULT_DB_PATH
  return Path.isAbsolute(configuredPath)
    ? configuredPath
    : Path.resolve(process.cwd(), configuredPath)
}

export const getDbClient = () => {
  if (dbClientSingleton) {
    return dbClientSingleton
  }

  const Database = getDatabaseCtor()
  const KyselyCtorRef = KyselyCtor
  const BunSqliteDialectRef = BunSqliteDialectCtor

  if (!KyselyCtorRef || !BunSqliteDialectRef) {
    throw (
      kyselyImportError ||
      bunSqliteImportError ||
      new Error("Database dependencies are not available in this environment")
    )
  }

  const database = new Database(getResolvedDbPath())
  bootstrapCompatibilitySchema(database)

  dbClientSingleton = new KyselyCtorRef<DB>({
    dialect: new BunSqliteDialectRef({
      database,
    }),
  })

  return dbClientSingleton
}

export const getBunDatabaseClient = () => {
  const Database = getDatabaseCtor()
  return new Database(getResolvedDbPath())
}
