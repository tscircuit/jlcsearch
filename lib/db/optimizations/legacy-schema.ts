import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const legacySchema: DbOptimizationSpec = {
  name: "create_legacy_schema",
  description:
    "Creates legacy components, categories, and v_components to support older queries.",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const tableExists = await sql`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='components'
    `.execute(db)
    return tableExists.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    console.log("Cleaning up incomplete legacy tables if any...")
    await sql`DROP TABLE IF EXISTS categories`.execute(db)
    await sql`DROP TABLE IF EXISTS components`.execute(db)
    await sql`DROP VIEW IF EXISTS v_components`.execute(db)

    console.log("Creating categories table...")
    await sql`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        subcategory TEXT
      )
    `.execute(db)

    console.log("Populating categories...")
    await sql`
      INSERT INTO categories (category, subcategory)
      SELECT DISTINCT category, subcategory FROM jlc_components
    `.execute(db)

    console.log("Indexing categories...")
    await sql`
      CREATE INDEX idx_categories_cat_sub ON categories (category, subcategory)
    `.execute(db)

    console.log("Creating components table...")
    await sql`
      CREATE TABLE components AS
      SELECT 
        j.lcsc,
        c.id AS category_id,
        j.mfr,
        j.package,
        j.joints,
        j.manufacturer,
        CASE WHEN j.library_type = 'Basic' THEN 1 ELSE 0 END AS basic,
        j.preferred,
        j.description,
        j.datasheet,
        j.stock,
        j.price,
        j.attributes AS extra,
        j.last_on_stock,
        j.fetched_at AS last_update,
        1 AS manufacturer_id
      FROM jlc_components j
      JOIN categories c ON j.category = c.category AND j.subcategory = c.subcategory
    `.execute(db)

    console.log("Creating v_components view...")
    await sql`
      CREATE VIEW v_components AS
      SELECT 
        c.basic,
        cat.category,
        c.category_id,
        c.datasheet,
        c.description,
        c.extra,
        c.joints,
        c.last_on_stock,
        c.lcsc,
        c.manufacturer,
        c.mfr,
        c.package,
        c.preferred,
        c.price,
        c.stock,
        cat.subcategory
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
    `.execute(db)

    console.log("Legacy schema created successfully!")
  },
}
