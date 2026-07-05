import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from basic/preferred flags",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql<{ name: string }>`
      PRAGMA table_xinfo(components)
    `.execute(db)

    return result.rows.some((row) => row.name === "is_extended_promotional")
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (basic = 0 AND preferred = 1)
    `.execute(db)

    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
