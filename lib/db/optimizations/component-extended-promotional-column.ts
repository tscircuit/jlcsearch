import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column and index to components table derived from extra/attributes or data source promotional markers",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return Boolean(ex && "is_extended_promotional" in ex)
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column to components table
    await sql`
      ALTER TABLE components 
      ADD COLUMN is_extended_promotional boolean DEFAULT 0
    `.execute(db)

    // Create an index on the new column for fast filtering
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
