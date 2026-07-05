import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

export const componentView: DbOptimizationSpec = {
  name: "v_components",
  description:
    "View joining components with category and manufacturer metadata for list routes",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master
      WHERE type='view' AND name=${this.name}
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      CREATE VIEW v_components AS
      SELECT
        components.lcsc,
        components.mfr,
        components.package,
        components.description,
        components.stock,
        components.price,
        components.extra,
        components.basic,
        components.preferred,
        components.category_id,
        components.datasheet,
        components.joints,
        components.last_on_stock,
        categories.category,
        categories.subcategory,
        manufacturers.name AS manufacturer
      FROM components
      LEFT JOIN categories ON categories.id = components.category_id
      LEFT JOIN manufacturers ON manufacturers.id = components.manufacturer_id
    `.execute(db)
  },
}
