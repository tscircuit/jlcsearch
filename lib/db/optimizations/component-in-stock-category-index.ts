import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentInStockCategoryIndex: DbOptimizationSpec = {
  name: "idx_components_in_stock_category",
  description:
    "Compound index on components.in_stock and category_id for faster filtered queries",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name=${this.name}
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await db.schema
      .createIndex(this.name)
      .on("components")
      .columns(["in_stock", "category_id"])
      .execute()
  },
}
