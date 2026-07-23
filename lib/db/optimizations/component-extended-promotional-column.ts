import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional VIRTUAL column derived from preferred and basic columns, plus an index",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      PRAGMA table_xinfo(components)
    `.execute(db)
    return result.rows.some((r: any) => r.name === "is_extended_promotional")
  },

  async execute(db: KyselyDatabaseInstance) {
    // VIRTUAL generated column. Encoding verified via jlcparts source:
    // pullExtraAttributes() in datatables.py synthesizes "Basic/Extended"
    // from preferred + basic columns. JLCPCB docs confirm preferred
    // extended parts are "exempt from Feeders Loading fee" = temporarily
    // basic-priced. COALESCE(basic,0) guards against NULLs in legacy data.
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (
        CASE WHEN preferred = 1 AND COALESCE(basic, 0) = 0
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
