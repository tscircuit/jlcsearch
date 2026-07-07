import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional column to components table derived from preferred",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      PRAGMA table_info(components)
    `.execute(db)

    return result.rows.some(
      (row: any) => row.name === "is_extended_promotional",
    )
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)

    await sql`
      UPDATE components
      SET is_extended_promotional = preferred
    `.execute(db)

    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
