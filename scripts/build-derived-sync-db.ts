import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import type { DB } from "lib/db/generated/kysely"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"

const tableExists = (database: Database, schema: string, table: string) =>
  Boolean(
    database
      .query(
        `SELECT 1
         FROM ${schema}.sqlite_master
         WHERE type = 'table' AND name = ?
         LIMIT 1`,
      )
      .get(table),
  )

export const buildDerivedSyncDatabase = async ({
  sourcePath,
  outputPath,
  recoveryPath,
  tableNames,
  includeComponentCatalog = false,
  includeStockSnapshot = false,
  logger = console.log,
}: {
  sourcePath: string
  outputPath: string
  recoveryPath?: string
  tableNames?: string[]
  includeComponentCatalog?: boolean
  includeStockSnapshot?: boolean
  logger?: (message: string) => void
}) => {
  const resolvedSourcePath = path.resolve(sourcePath)
  const resolvedOutputPath = path.resolve(outputPath)

  if (!existsSync(resolvedSourcePath)) {
    throw new Error(`Source database does not exist: ${resolvedSourcePath}`)
  }
  if (resolvedSourcePath === resolvedOutputPath) {
    throw new Error("Source and output database paths must be different")
  }

  const resolvedRecoveryPath = recoveryPath
    ? path.resolve(recoveryPath)
    : undefined
  if (
    resolvedRecoveryPath &&
    (resolvedRecoveryPath === resolvedOutputPath ||
      !existsSync(resolvedRecoveryPath))
  ) {
    throw new Error("Recovery database must exist and differ from the output")
  }

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true })
  await rm(resolvedOutputPath, { force: true })

  const database = new Database(resolvedOutputPath, { create: true })
  database.run("ATTACH DATABASE ? AS source", [resolvedSourcePath])

  if (
    !tableExists(database, "source", "jlc_components") ||
    !tableExists(database, "source", "lcsc_components")
  ) {
    database.close()
    throw new Error(
      "Expected a source-db-v2 database with jlc_components and lcsc_components",
    )
  }

  if (resolvedRecoveryPath) {
    database.run("ATTACH DATABASE ? AS recovery", [resolvedRecoveryPath])
    for (const table of ["jlc_components", "lcsc_components"]) {
      if (!tableExists(database, "recovery", table)) {
        database.close()
        throw new Error(`Recovery database is missing ${table}`)
      }
      const sourceColumns = database
        .query<{ name: string }, []>(`PRAGMA source.table_info(${table})`)
        .all()
        .map((c) => c.name)
      const recoveryColumns = new Set(
        database
          .query<{ name: string }, []>(`PRAGMA recovery.table_info(${table})`)
          .all()
          .map((c) => c.name),
      )
      if (sourceColumns.some((column) => !recoveryColumns.has(column))) {
        database.close()
        throw new Error(`Recovery schema does not match ${table}`)
      }
      const columns = sourceColumns
        .map((column) => `"${column.replaceAll('"', '""')}"`)
        .join(",")
      if (table === "jlc_components")
        database.exec(`CREATE TEMP VIEW input_${table} AS
        SELECT ${columns}, 'upstream_snapshot' AS stock_source FROM source.${table}
        UNION ALL
        SELECT ${columns}, 'recovery_metadata' AS stock_source FROM recovery.${table} AS old
        WHERE NOT EXISTS (SELECT 1 FROM source.${table} AS current WHERE current.lcsc = old.lcsc);`)
    }
    logger(
      "Recovery enabled: current source records take precedence; recovered stock is unknown until verified live.",
    )
  } else {
    for (const table of ["jlc_components"]) {
      database.exec(
        `CREATE TEMP VIEW input_${table} AS SELECT *, 'upstream_snapshot' AS stock_source FROM source.${table}`,
      )
    }
  }

  // Joining a UNION ALL metadata view materializes every LCSC row on each
  // derived-table batch. Direct joins use both source primary-key indexes.
  const lcscJoin = resolvedRecoveryPath
    ? `LEFT JOIN source.lcsc_components AS l ON l.lcsc = j.lcsc
       LEFT JOIN recovery.lcsc_components AS recovered_l
         ON recovered_l.lcsc = j.lcsc AND l.lcsc IS NULL`
    : "LEFT JOIN source.lcsc_components AS l ON l.lcsc = j.lcsc"
  const lcscColumn = (name: "attributes" | "manufacturer" | "url_slug") =>
    resolvedRecoveryPath
      ? `(CASE WHEN l.lcsc IS NOT NULL THEN l.${name} ELSE recovered_l.${name} END)`
      : `l.${name}`

  // The pinned archive recovers catalog metadata, not current availability.
  // An unknown quantity stays NULL and is excluded from in-stock searches.
  const stockColumn =
    "CASE WHEN j.stock_source = 'recovery_metadata' THEN NULL ELSE j.stock END"

  database.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      UNIQUE(category, subcategory)
    );

    INSERT INTO categories(category, subcategory)
    SELECT DISTINCT category, subcategory
    FROM input_jlc_components
    WHERE present = 1
      AND last_on_stock >= unixepoch('now', '-1 year')
    ORDER BY category, subcategory;

    CREATE TEMP VIEW components AS
    SELECT
      j.lcsc,
      c.id AS category_id,
      j.mfr,
      j.package,
      j.joints,
      0 AS manufacturer_id,
      CASE WHEN j.library_type = 'base' THEN 1 ELSE 0 END AS basic,
      j.preferred,
      CASE WHEN j.library_type != 'base' AND j.preferred = 1 THEN 1 ELSE 0 END AS is_extended_promotional,
      j.description,
      j.datasheet,
      ${stockColumn} AS stock,
      j.price,
      j.last_on_stock,
      j.fetched_at AS last_update,
      j.sync_seen AS flag,
      CASE WHEN (${stockColumn}) > 0 THEN 1 ELSE 0 END AS in_stock,
      json_object(
        'attributes',
        json(
          json_patch(
            CASE
              WHEN json_valid(j.attributes) THEN j.attributes
              ELSE '{}'
            END,
            CASE
              WHEN json_valid(${lcscColumn("attributes")}) THEN ${lcscColumn("attributes")}
              ELSE '{}'
            END
          )
        ),
        'manufacturer',
        coalesce(
          NULLIF(${lcscColumn("manufacturer")}, ''),
          NULLIF(j.manufacturer, '')
        ),
        'url',
        CASE
          WHEN ${lcscColumn("url_slug")} IS NOT NULL AND ${lcscColumn("url_slug")} != ''
          THEN 'https://lcsc.com/product-detail/' || ${lcscColumn("url_slug")} || '_C' || j.lcsc || '.html'
          ELSE NULL
        END
      ) AS extra
    FROM input_jlc_components AS j
    INNER JOIN main.categories AS c
      ON c.category = j.category
      AND c.subcategory = j.subcategory
    ${lcscJoin}
    WHERE j.present = 1
      AND j.last_on_stock >= unixepoch('now', '-1 year');
  `)

  if (includeComponentCatalog) {
    database.exec(`
      CREATE TABLE component_catalog AS
      SELECT
        j.lcsc,
        j.category,
        j.subcategory,
        j.mfr,
        j.package,
        CASE WHEN j.library_type = 'base' THEN 1 ELSE 0 END AS basic,
        j.preferred,
        j.description,
        ${stockColumn} AS stock,
        j.price,
        json_object(
          'number', 'C' || j.lcsc,
          'manufacturer', json_object(
            'name', coalesce(
              NULLIF(${lcscColumn("manufacturer")}, ''),
              NULLIF(j.manufacturer, '')
            )
          ),
          'title', trim(
            coalesce(
              NULLIF(${lcscColumn("manufacturer")}, ''),
              NULLIF(j.manufacturer, ''),
              ''
            ) || ' ' || j.mfr
          ),
          'mpn', j.mfr,
          'package', j.package,
          'attributes', json(
            json_patch(
              CASE
                WHEN json_valid(j.attributes) THEN j.attributes
                ELSE '{}'
              END,
              CASE
                WHEN json_valid(${lcscColumn("attributes")}) THEN ${lcscColumn("attributes")}
                ELSE '{}'
              END
            )
          ),
          'description', j.description,
          'url', CASE
            WHEN ${lcscColumn("url_slug")} IS NOT NULL AND ${lcscColumn("url_slug")} != ''
            THEN 'https://lcsc.com/product-detail/' || ${lcscColumn("url_slug")} || '_C' || j.lcsc || '.html'
            ELSE NULL
          END
        ) AS extra
      FROM input_jlc_components AS j
      ${lcscJoin}
      WHERE j.present = 1
        AND j.last_on_stock >= unixepoch('now', '-1 year');

      CREATE INDEX idx_component_catalog_lcsc ON component_catalog(lcsc);
      CREATE INDEX idx_component_catalog_stock ON component_catalog(stock DESC);
    `)
  }

  if (includeStockSnapshot) {
    database.exec(`
      CREATE TABLE component_stock (
        lcsc INTEGER PRIMARY KEY,
        stock INTEGER,
        subcategory TEXT,
        stock_source TEXT,
        record_fetched_at INTEGER,
        stock_checked_at INTEGER
      );

      INSERT INTO component_stock(lcsc, stock, subcategory, stock_source, record_fetched_at)
      SELECT
        lcsc,
        CASE WHEN stock_source = 'recovery_metadata' THEN NULL
             WHEN present = 1 THEN coalesce(stock, 0) ELSE 0 END,
        subcategory,
        stock_source,
        fetched_at
      FROM input_jlc_components
      WHERE last_on_stock >= unixepoch('now', '-1 year');
    `)
  }

  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await setupDerivedTables({
      db,
      tableNames,
      logger,
    })
    database.exec("ANALYZE")
  } finally {
    await db.destroy()
  }
}

const main = async () => {
  const sourcePath =
    process.env.SOURCE_DB_PATH?.trim() || path.resolve("cache.sqlite3")
  const outputPath =
    process.env.OUTPUT_DB_PATH?.trim() || path.resolve("db.sqlite3")
  const configuredTables = process.env.DERIVED_TABLES_LIST?.split(",")
    .map((table) => table.trim())
    .filter(Boolean)
  const includeComponentCatalog =
    process.env.INCLUDE_COMPONENT_CATALOG?.trim() === "1"
  const includeStockSnapshot =
    process.env.INCLUDE_STOCK_SNAPSHOT?.trim() === "1"

  await buildDerivedSyncDatabase({
    sourcePath,
    outputPath,
    recoveryPath: process.env.RECOVERY_DB_PATH?.trim() || undefined,
    tableNames: configuredTables?.length ? configuredTables : undefined,
    includeComponentCatalog,
    includeStockSnapshot,
  })
}

if (import.meta.main) {
  await main()
}
