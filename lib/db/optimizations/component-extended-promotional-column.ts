import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "idx_components_is_extended_promotional",
  description: "Generated column and index for extended promotional components",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name=${this.name}
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional INTEGER
      GENERATED ALWAYS AS (
        CASE WHEN preferred = 1 AND basic = 0 THEN 1 ELSE 0 END
      ) VIRTUAL
    `.execute(db)

    await db.schema
      .createIndex(this.name)
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
