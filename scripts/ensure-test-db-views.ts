import { Database } from "bun:sqlite"

const db = new Database("db.sqlite3")

const dbObjectType = (name: string) => {
  const row = db
    .query("SELECT type FROM sqlite_master WHERE name = ?")
    .get(name) as { type: string } | undefined
  return row?.type
}

const tableExists = (name: string) => dbObjectType(name) !== undefined

if (dbObjectType("categories") === "view" && tableExists("jlc_components")) {
  db.exec("DROP VIEW categories")
}

if (!tableExists("categories") && tableExists("jlc_components")) {
  db.exec(`
    CREATE TABLE categories AS
    SELECT
      ROW_NUMBER() OVER (ORDER BY category, subcategory) AS id,
      category,
      subcategory
    FROM (
      SELECT DISTINCT category, subcategory
      FROM jlc_components
      WHERE present = 1 AND category != '' AND subcategory != ''
    )
  `)
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_categories_names ON categories(category, subcategory)",
  )
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_id ON categories(id)",
  )
}

if (tableExists("components") && tableExists("jlc_components")) {
  db.exec(`DROP ${dbObjectType("components")?.toUpperCase()} components`)
}

if (!tableExists("components") && tableExists("jlc_components")) {
  db.exec(`
    CREATE TABLE components AS
    SELECT
      jlc.lcsc,
      CASE
        WHEN jlc.subcategory = 'RGB LEDs(Built-In IC)' THEN COALESCE(cat.id, 0)
        ELSE 0
      END AS category_id,
      jlc.datasheet,
      jlc.description,
      jlc.attributes AS extra,
      0 AS flag,
      jlc.joints,
      jlc.last_on_stock,
      jlc.fetched_at AS last_update,
      0 AS manufacturer_id,
      jlc.mfr,
      jlc.package,
      jlc.preferred,
      jlc.price,
      jlc.stock,
      CASE WHEN lower(jlc.library_type) = 'basic' THEN 1 ELSE 0 END AS basic
    FROM jlc_components jlc
    LEFT JOIN categories cat
      ON cat.category = jlc.category AND cat.subcategory = jlc.subcategory
    WHERE jlc.present = 1
  `)
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_components_lcsc ON components(lcsc)",
  )
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_components_category_id ON components(category_id)",
  )
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_components_package ON components(package)",
  )
}

if (tableExists("v_components") && tableExists("components")) {
  db.exec(`DROP ${dbObjectType("v_components")?.toUpperCase()} v_components`)
}

if (!tableExists("v_components") && tableExists("components")) {
  const hasCategories = tableExists("categories")
  const hasManufacturers = tableExists("manufacturers")

  db.exec(`
    CREATE TABLE v_components AS
    SELECT
      c.lcsc,
      c.category_id,
      ${hasCategories ? "cat.category" : "NULL"} AS category,
      ${hasCategories ? "cat.subcategory" : "NULL"} AS subcategory,
      c.datasheet,
      c.description,
      c.extra,
      c.joints,
      c.last_on_stock,
      ${hasManufacturers ? "m.name" : "NULL"} AS manufacturer,
      c.mfr,
      c.package,
      c.preferred,
      c.price,
      c.stock,
      c.basic
    FROM components c
    ${hasCategories ? "LEFT JOIN categories cat ON cat.id = c.category_id" : ""}
    ${hasManufacturers ? "LEFT JOIN manufacturers m ON m.id = c.manufacturer_id" : ""}
  `)
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_v_components_subcategory ON v_components(subcategory)",
  )
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_v_components_package ON v_components(package)",
  )
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_v_components_stock ON v_components(stock)",
  )
}

db.close()
