import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

export const componentViewExtendedPromotional: DbOptimizationSpec = {
  name: "v_components.extended_promotional",
  description:
    "Expose components.extended_promotional through the v_components view",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT sql FROM sqlite_master
      WHERE type='view'
        AND name='v_components'
        AND sql LIKE '%extended_promotional%'
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`DROP VIEW IF EXISTS v_components`.execute(db)
    await sql`
      CREATE VIEW v_components AS
      SELECT
        components.basic AS basic,
        categories.category AS category,
        components.category_id AS category_id,
        components.datasheet AS datasheet,
        components.description AS description,
        components.extended_promotional AS extended_promotional,
        components.extra AS extra,
        components.joints AS joints,
        components.last_on_stock AS last_on_stock,
        components.lcsc AS lcsc,
        manufacturers.name AS manufacturer,
        components.mfr AS mfr,
        components.package AS package,
        components.preferred AS preferred,
        components.price AS price,
        components.stock AS stock,
        categories.subcategory AS subcategory
      FROM components
      LEFT JOIN categories ON components.category_id = categories.id
      LEFT JOIN manufacturers ON components.manufacturer_id = manufacturers.id
    `.execute(db)
  },
}
