import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalCategoryIndex: DbOptimizationSpec = {
  name: "idx_components_is_extended_promotional_category",
  description:
    "Compound index on components.is_extended_promotional and category_id for faster filtered queries",

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
      .columns(["is_extended_promotional", "category_id"])
      .execute()
  },
}
