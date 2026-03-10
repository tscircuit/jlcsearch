import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const vComponentsExtendedPromotional: DbOptimizationSpec = {
  name: "v_components_add_is_extended_promotional",
  description:
    "Recreates v_components view to include is_extended_promotional and flag columns",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    try {
      const { rows } = await sql<any>`
        SELECT is_extended_promotional FROM v_components LIMIT 1
      `.execute(db)
      return true
    } catch {
      // Column doesn't exist in view, or view doesn't exist
      return false
    }
  },

  async execute(db: KyselyDatabaseInstance) {
    // Get the current view definition
    const { rows } = await sql<any>`
      SELECT sql FROM sqlite_master WHERE type='view' AND name='v_components'
    `.execute(db)

    if (rows.length === 0) {
      // View doesn't exist, nothing to do
      return
    }

    // Drop and recreate the view with the new columns
    await sql`DROP VIEW IF EXISTS v_components`.execute(db)

    await sql`
      CREATE VIEW v_components AS
      SELECT
        c.lcsc,
        c.mfr,
        c.package,
        c.description,
        c.stock,
        c.price,
        c.extra,
        c.basic,
        c.preferred,
        c.flag,
        c.is_extended_promotional,
        c.datasheet,
        c.joints,
        c.last_on_stock,
        c.category_id,
        cat.category,
        cat.subcategory,
        m.name as manufacturer
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
    `.execute(db)
  },
}
