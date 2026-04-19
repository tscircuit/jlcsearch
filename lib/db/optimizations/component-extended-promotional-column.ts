import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds extended_promotional column to components table for tracking extended promotional parts",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [row],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "extended_promotional" in row
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components ADD COLUMN extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)
  },
}
