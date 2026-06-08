import { Database } from "bun:sqlite"

const db = new Database("db.sqlite3")

const tableExists = (name: string) => {
  const row = db
    .query("SELECT count(*) AS count FROM sqlite_master WHERE name = ?")
    .get(name) as { count: number } | undefined
  return (row?.count ?? 0) > 0
}

if (!tableExists("components") && tableExists("jlc_components")) {
  db.exec(`
    CREATE VIEW components AS
    SELECT
      lcsc,
      0 AS category_id,
      datasheet,
      description,
      attributes AS extra,
      0 AS flag,
      joints,
      last_on_stock,
      fetched_at AS last_update,
      0 AS manufacturer_id,
      mfr,
      package,
      preferred,
      price,
      stock,
      CASE WHEN lower(library_type) = 'basic' THEN 1 ELSE 0 END AS basic
    FROM jlc_components
    WHERE present = 1
  `)
}

if (!tableExists("v_components") && tableExists("components")) {
  const hasCategories = tableExists("categories")
  const hasManufacturers = tableExists("manufacturers")

  db.exec(`
    CREATE VIEW v_components AS
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
}

db.close()
