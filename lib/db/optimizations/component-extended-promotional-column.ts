import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from extra JSON componentLibraryType",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [colCheck],
    } = await sql<any>`
      SELECT COUNT(*) as cnt FROM pragma_table_info('components') WHERE name='is_extended_promotional'
    `.execute(db)

    return colCheck.cnt > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    const {
      rows: [colCheck],
    } = await sql<any>`
      SELECT COUNT(*) as cnt FROM pragma_table_info('components') WHERE name='jlc_extra'
    `.execute(db)

    const hasJlcExtra = colCheck.cnt > 0

    const expression = hasJlcExtra
      ? sql`(
          json_extract(extra, '$.componentLibraryType') IN ('expand', 'expandPrefer')
          OR json_extract(jlc_extra, '$.componentLibraryType') IN ('expand', 'expandPrefer')
        )`
      : sql`(
          json_extract(extra, '$.componentLibraryType') IN ('expand', 'expandPrefer')
        )`

    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (${expression})
    `.execute(db)

    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
