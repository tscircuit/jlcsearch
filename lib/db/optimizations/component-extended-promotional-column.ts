import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from basic = 0 AND preferred = 1",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column as a generated/computed column
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (basic = 0 AND preferred = 1)
    `.execute(db)

    // Create an index on the new column
    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
