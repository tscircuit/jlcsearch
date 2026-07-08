import { sql } from "kysely"
import { DERIVED_TABLES } from "lib/db/derivedtables/setup-derived-tables"
import type { KyselyDatabaseInstance } from "../kysely-types"

type SqliteColumn = {
  name: string
}

const titleFromTableName = (tableName: string) =>
  tableName
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const tableExists = async (db: KyselyDatabaseInstance, tableName: string) => {
  const result = await sql`
    SELECT name FROM sqlite_master
    WHERE type IN ('table', 'view') AND name=${tableName}
  `.execute(db)

  return result.rows.length > 0
}

const getTableColumns = async (
  db: KyselyDatabaseInstance,
  tableName: string,
) => {
  const result =
    await sql<SqliteColumn>`PRAGMA table_info(${sql.raw(tableName)})`.execute(
      db,
    )

  return new Set(result.rows.map((row) => row.name))
}

const sqlIdentifier = (name: string) => sql.raw(`"${name.replace(/"/g, '""')}"`)

export const ensureComponentSourceCompat = async (
  db: KyselyDatabaseInstance,
) => {
  if (await tableExists(db, "components")) {
    return
  }

  const sourceTables = []
  for (const tableSpec of DERIVED_TABLES) {
    if (await tableExists(db, tableSpec.tableName)) {
      sourceTables.push(tableSpec.tableName)
    }
  }

  if (sourceTables.length === 0) {
    return
  }

  if (!(await tableExists(db, "categories"))) {
    await sql`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY,
        category TEXT,
        subcategory TEXT
      )
    `.execute(db)

    for (const [index, tableName] of sourceTables.entries()) {
      await sql`
        INSERT INTO categories (id, category, subcategory)
        VALUES (${index + 1}, ${titleFromTableName(tableName)}, ${tableName})
      `.execute(db)
    }
  }

  await sql`
    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY,
      mfr TEXT,
      description TEXT,
      stock INTEGER,
      price TEXT,
      package TEXT,
      extra TEXT,
      basic INTEGER NOT NULL DEFAULT 0,
      preferred INTEGER NOT NULL DEFAULT 0,
      in_stock INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER,
      last_on_stock INTEGER
    )
  `.execute(db)

  for (const [index, tableName] of sourceTables.entries()) {
    const columns = await getTableColumns(db, tableName)
    const table = sqlIdentifier(tableName)
    const packageExpr = columns.has("package") ? sql`package` : sql`NULL`
    const attributesExpr = columns.has("attributes")
      ? sql`attributes`
      : sql`NULL`
    const basicExpr = columns.has("is_basic")
      ? sql`COALESCE(is_basic, 0)`
      : sql`0`
    const preferredExpr = columns.has("is_preferred")
      ? sql`COALESCE(is_preferred, 0)`
      : sql`0`

    await sql`
      INSERT OR IGNORE INTO components (
        lcsc,
        mfr,
        description,
        stock,
        price,
        package,
        extra,
        basic,
        preferred,
        in_stock,
        category_id,
        last_on_stock
      )
      SELECT
        lcsc,
        mfr,
        description,
        COALESCE(stock, 0),
        CASE
          WHEN price1 IS NULL THEN '[]'
          ELSE json_array(json_object('price', CAST(price1 AS TEXT)))
        END,
        ${packageExpr},
        ${attributesExpr},
        ${basicExpr},
        ${preferredExpr},
        CASE WHEN COALESCE(stock, 0) > 0 THEN 1 ELSE 0 END,
        ${index + 1},
        NULL
      FROM ${table}
      WHERE lcsc IS NOT NULL
    `.execute(db)
  }

  if (!(await tableExists(db, "v_components"))) {
    await sql`
      CREATE VIEW v_components AS
      SELECT
        components.*,
        categories.category,
        categories.subcategory
      FROM components
      LEFT JOIN categories ON components.category_id = categories.id
    `.execute(db)
  }
}
