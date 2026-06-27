import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds extended_promotional boolean column to components table derived from flag & 2",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column - extended promotional parts have flag bit 2 set
    await sql`
      ALTER TABLE components 
      ADD COLUMN extended_promotional boolean 
      GENERATED ALWAYS AS ((flag & 2) = 2)
    `.execute(db)

    // Create an index on the new column
    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("extended_promotional")
      .execute()
  },
}
