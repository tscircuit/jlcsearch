import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const adaptUpstreamSchema: DbOptimizationSpec = {
  name: "adapt_upstream_schema",
  description: "Adapt new upstream jlc_components schema to legacy components table if needed",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master WHERE type='table' AND name='components'
    `.execute(db)
    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    const hasNewSchema = await sql`
      SELECT name FROM sqlite_master WHERE type='table' AND name='jlc_components'
    `.execute(db)

    if (hasNewSchema.rows.length === 0) {
      console.log("No jlc_components found, upstream schema is already legacy or empty. Skipping adapter.")
      return
    }

    console.log("Found jlc_components table. Creating legacy schema...")

    // 1. Create categories table
    await sql`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        UNIQUE(category, subcategory)
      )
    `.execute(db)

    await sql`
      INSERT INTO categories (category, subcategory)
      SELECT DISTINCT category, subcategory FROM jlc_components
    `.execute(db)

    // 2. Create components table using data from jlc_components and the new categories table
    await sql`
      CREATE TABLE components AS
      SELECT 
        jlc.lcsc as lcsc,
        cat.id as category_id,
        jlc.mfr as mfr,
        jlc.package as package,
        jlc.joints as joints,
        1 as manufacturer_id,
        (CASE WHEN jlc.library_type = 'base' THEN 1 ELSE 0 END) as basic,
        jlc.preferred as preferred,
        jlc.description as description,
        jlc.datasheet as datasheet,
        jlc.stock as stock,
        jlc.last_on_stock as last_on_stock,
        jlc.price as price,
        jlc.fetched_at as last_update,
        '{"attributes":' || jlc.attributes || '}' as extra,
        0 as flag,
        0 as is_extended_promotional
      FROM jlc_components jlc
      LEFT JOIN categories cat ON jlc.category = cat.category AND jlc.subcategory = cat.subcategory
    `.execute(db)

    console.log("Successfully created legacy components table from jlc_components.")
  },
}
