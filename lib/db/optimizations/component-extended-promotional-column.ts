import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds extended_promotional column to components table derived from preferred and basic",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      PRAGMA table_info(components)
    `.execute(db)

    return result.rows.some(
      (row: any) => row.name === "extended_promotional",
    )
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)

    await sql`
      UPDATE components
      SET extended_promotional = CASE WHEN preferred = 1 AND basic = 0 THEN 1 ELSE 0 END
    `.execute(db)

    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("extended_promotional")
      .execute()
  },
}
