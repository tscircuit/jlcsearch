import type { DbOptimizationSpec } from "./types"
import { sql } from "kysely"

export const componentIsExtendedPromotionalColumnSpec: DbOptimizationSpec = {
  name: "component-is-extended-promotional-column",
  description: "add is_extended_promotional column to components table",
  async checkIfAdded(db) {
    const result = await sql<{ name: string }>`PRAGMA table_info(components)`.execute(db)
    return result.rows.some((col) => col.name === "is_extended_promotional")
  },
  async execute(db) {
    await sql`ALTER TABLE components ADD COLUMN is_extended_promotional INTEGER`.execute(db)
  },
}
