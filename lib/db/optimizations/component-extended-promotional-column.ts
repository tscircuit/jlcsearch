import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

/**
 * Adds an `is_extended_promotional` generated boolean column to the components
 * table.
 *
 * An "extended promotional" part is defined as a component that JLCPCB has
 * designated as a preferred (promotional) part but that is NOT a basic part.
 * In other words: preferred = 1 AND basic = 0.
 *
 * This follows the terminology used in the JLCPCB / EasyEDA component library
 * where "extended" refers to non-basic parts that still carry a promotional
 * discount/priority status.
 */
export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table (preferred=1 AND basic=0)",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the generated column derived from existing preferred and basic flags
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (preferred = 1 AND basic = 0)
    `.execute(db)

    // Index to make filtering by this column fast
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
