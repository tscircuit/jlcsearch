import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentPreferredIndex: DbOptimizationSpec = {
  name: "idx_components_preferred",
  description:
    "Index on components.preferred for faster preferred component queries",

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
      .column("preferred")
      .execute()
  },
}
