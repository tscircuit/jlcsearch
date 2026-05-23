import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalIndex: DbOptimizationSpec = {
  name: "idx_components_is_extended_promotional",
  description:
    "Index on components.is_extended_promotional for faster filtering of extended promotional components",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column to the components table
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional INTEGER DEFAULT 0
    `.execute(db)

    // Create an index on the new column
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
