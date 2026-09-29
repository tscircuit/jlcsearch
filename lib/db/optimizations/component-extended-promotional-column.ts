import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from promotional metadata or extra attributes",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const { rows } = await sql<any>`PRAGMA table_xinfo(components)`.execute(db)
    if (rows && rows.length > 0) {
      return rows.some((row: any) => row.name === "is_extended_promotional")
    }
    const result = await sql<any>`SELECT * FROM components LIMIT 1`.execute(db)
    return Boolean(
      result.rows[0] && "is_extended_promotional" in result.rows[0],
    )
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column
    await sql`
      ALTER TABLE components 
      ADD COLUMN is_extended_promotional boolean 
      GENERATED ALWAYS AS (
        CASE WHEN json_valid(extra) AND (
          json_extract(extra, '$.is_extended_promotional') = 1
          OR json_extract(extra, '$.is_extended_promotional') = 'true'
          OR json_extract(extra, '$.library_type') = 'promotional'
          OR json_extract(extra, '$.library_type') = 'expand_promotional'
          OR json_extract(extra, '$.library_type') = 'extended_promotional'
          OR json_extract(extra, '$.promotional') = 1
          OR json_extract(extra, '$.promotional') = 'true'
        ) THEN 1 ELSE 0 END
      )
    `.execute(db)

    // Create an index on the new column
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .ifNotExists()
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
