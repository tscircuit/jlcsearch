import { getBunDatabaseClient } from "lib/db/get-db-client"

async function main() {
  const db = getBunDatabaseClient()
  console.log("Migrating from new jlcparts schema (jlc_components) to legacy schema...")
  db.run(`
    CREATE TABLE categories AS 
    SELECT row_number() over (ORDER BY category, subcategory) as id, category, subcategory 
    FROM (SELECT DISTINCT category, subcategory FROM jlc_components);
  `)
  db.run(`
    CREATE TABLE manufacturers AS
    SELECT row_number() over (ORDER BY manufacturer) as id, manufacturer as name
    FROM (SELECT DISTINCT manufacturer FROM jlc_components);
  `)
  db.run(`
    CREATE TABLE components AS
    SELECT
      j.lcsc,
      c.id as category_id,
      m.id as manufacturer_id,
      j.mfr,
      j.package,
      j.joints,
      CASE WHEN j.library_type = 'Basic' THEN 1 ELSE 0 END as basic,
      j.preferred,
      j.last_on_stock,
      j.description,
      j.datasheet,
      j.stock,
      j.price,
      0 as last_update,
      0 as flag,
      j.attributes as extra
    FROM jlc_components j
    LEFT JOIN categories c ON j.category = c.category AND j.subcategory = c.subcategory
    LEFT JOIN manufacturers m ON j.manufacturer = m.name;
  `)
  console.log("Migration complete.")
  db.close()
}
main().catch(console.error)
