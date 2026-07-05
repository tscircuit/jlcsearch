import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { sql } from "kysely"

export const componentExtendedPromotionalIndex: DbOptimizationSpec = {
  name: "add_components_extended_promotional_index",
  description:
    "Adds index on components.extended_promotional column for faster filtering",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql<{ name: string }>`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND name='idx_components_extended_promotional'
    `.execute(db)
    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("extended_promotional")
      .execute()
  },
}
