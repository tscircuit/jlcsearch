import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalIndex: DbOptimizationSpec = {
  name: "idx_components_is_extended_promotional",
  description:
    "Index on components.is_extended_promotional for faster filtering of extended promotional components",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name=${this.name}
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column if it does not already exist
    const colResult = await sql`PRAGMA table_info(components)`.execute(db)
    const cols = colResult.rows as Array<{ name: string }>
    if (!cols.some((r) => r.name === "is_extended_promotional")) {
      await sql`
        ALTER TABLE components
        ADD COLUMN is_extended_promotional INTEGER DEFAULT 0
      `.execute(db)
    }

    // Create an index on the new column
    await db.schema
      .createIndex(this.name)
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
