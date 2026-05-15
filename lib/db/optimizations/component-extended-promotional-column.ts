import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds extended_promotional boolean column to components table (preferred = 1 AND basic = 0)",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return ex != null && "extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN extended_promotional boolean
      GENERATED ALWAYS AS (preferred = 1 AND basic = 0)
    `.execute(db)

    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("extended_promotional")
      .execute()
  },
}
