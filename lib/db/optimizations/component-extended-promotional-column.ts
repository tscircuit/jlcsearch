import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

/**
 * "Extended promotional" parts are extended parts that JLCPCB temporarily
 * treats as basic parts for a limited time (no per-part loading fee during the
 * promotion). They are not flagged as basic in the upstream jlcparts data, but
 * the promotional library type is carried through in the component `extra` JSON
 * blob (the merged LCSC/JLC attributes, e.g. the "Library Type" attribute which
 * reads "Basic/Promotional Extended" for these parts).
 *
 * This adds a generated `is_extended_promotional` boolean column derived from
 * that data so it can be exposed as a filterable column, mirroring the existing
 * generated `in_stock` column (see component-in-stock-column.ts).
 */
export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table, true for extended parts JLCPCB temporarily makes available as basic (promotional), derived from the upstream extra/Library Type data",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the generated column. A part is "extended promotional" when it is not
    // a basic part (basic = 0) but its upstream data marks it as promotional.
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (
        basic = 0
        AND LOWER(COALESCE(extra, '')) LIKE '%promotional%'
      )
    `.execute(db)

    // Create an index on the new column for filter performance
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
