import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from extra JSON field",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return ex != null && "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column derived from the JSON extra field
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (
        CASE WHEN json_extract(extra, '$.promotional') IS NOT NULL
          AND json_extract(extra, '$.promotional') != 0
          AND json_extract(extra, '$.promotional') != 'false'
        THEN 1 ELSE 0 END
      )
    `.execute(db)

    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
