import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description: "Exposes the upstream preferred flag as is_extended_promotional",

  async checkIfAdded(db) {
    // table_xinfo also sees generated columns, including in an empty table.
    const result = await sql<{ name: string }>`
      SELECT name FROM pragma_table_xinfo('components')
      WHERE name = 'is_extended_promotional'
    `.execute(db)
    return result.rows.length > 0
  },

  async execute(db) {
    // JLCPCB's Promotional Extended filter uses preferredComponentFlag.
    // Do not add a !basic condition or infer a marker from free-form attributes.
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (preferred)
    `.execute(db)
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .ifNotExists()
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
