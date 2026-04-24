import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

/**
 * Adds is_extended_promotional column to components table.
 *
 * "Extended Promotional" refers to JLCPCB's program where certain extended
 * components are temporarily available without the standard extended assembly
 * fee — they act like Basic parts for a limited period. These correspond to
 * the "preferred" components in the jlcparts dataset that are NOT Basic.
 *
 * Data source: jlcparts `preferred` column (populated from JLCPCB's preferred
 * component list API) combined with `basic` column. A component is extended
 * promotional when it is marked preferred (promotional) but is not a Basic
 * library part.
 */
export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table — true when a component is in JLCPCB's Extended Promotional program (preferred=1 AND basic=0)",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add a generated column derived from preferred=1 AND basic=0.
    // SQLite GENERATED ALWAYS AS columns recompute automatically on every read.
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (preferred = 1 AND basic = 0)
    `.execute(db)

    // Index to speed up is_extended_promotional filter queries
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
