import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from the source data",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return ex != null && "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column, derived from json_extract of the extra field
    // JLCPCB marks "Extended Promotional" parts in the extra JSON blob
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (
        CASE WHEN json_extract(extra, '$.is_extended_promotional') = 1 THEN 1 ELSE 0 END
      ) STORED
    `.execute(db)

    // Create an index for filtering
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
