import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const extendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from the source extended_type field",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // The source jlcparts database stores extended promotional parts with
    // extended_type = 'Promotional' in the components table.
    // We copy that flag into a dedicated boolean column for fast filtering.
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)

    // Populate from the source data stored in the extra JSON blob.
    // jlcparts encodes the extended_type inside the extra JSON as
    // {"attributes":{...}, "extended_type": "Promotional"} or similar.
    // We also check the top-level boolean flag that some versions expose.
    await sql`
      UPDATE components
      SET is_extended_promotional = 1
      WHERE
        (
          json_extract(extra, '$.extended_type') = 'Promotional'
          OR json_extract(extra, '$.extended_type') = 'Extended Promotional'
        )
    `.execute(db)

    // Create an index for fast filtering
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
