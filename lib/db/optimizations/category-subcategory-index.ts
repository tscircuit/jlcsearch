import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const categorySubcategoryIndex: DbOptimizationSpec = {
  name: "idx_categories_subcategory",
  description:
    "Index on categories.subcategory for faster v_components subcategory filter queries (e.g. microphones, analog_switches)",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name=${this.name}
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      CREATE INDEX idx_categories_subcategory ON categories (subcategory)
    `.execute(db)
  },
}
