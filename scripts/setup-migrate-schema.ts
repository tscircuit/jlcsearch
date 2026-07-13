import { getBunDatabaseClient } from "lib/db/get-db-client"

async function main() {
  const db = getBunDatabaseClient()

  // Check if we have the new schema (jlc_components) and NO components table
  const hasJlcComponents = db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='jlc_components'").get()
  const hasComponents = db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='components'").get()

  if (hasJlcComponents && !hasComponents) {
    console.log("Migrating from new jlcparts schema (jlc_components) to legacy schema (components, categories, manufacturers, v_components)...")
    
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
    
    db.run(`
      CREATE VIEW v_components AS
      SELECT 
        c.lcsc,
        c.category_id,
        cat.category,
        cat.subcategory,
        c.manufacturer_id,
        m.name as manufacturer,
        c.mfr,
        c.package,
        c.joints,
        c.basic,
        c.preferred,
        c.last_on_stock,
        c.description,
        c.datasheet,
        c.stock,
        c.price,
        c.extra
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id;
    `)
    
    console.log("Migration complete.")
  } else {
    console.log("Schema migration skipped: jlc_components not found or components already exists.")
  }

  db.close()
}

main().catch(console.error)
