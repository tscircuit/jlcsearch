import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const removeStaleComponents: DbOptimizationSpec = {
  name: "remove_stale_components",
  description: "Removes components that haven't been in stock for over a year",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    // Check if any components exist with last_on_stock older than 1 year
    const result = await sql<{ count: number }>`
      SELECT COUNT(*) as count 
      FROM components 
      WHERE last_on_stock < strftime('%s', 'now', '-1 year')
    `.execute(db)

    // If no stale components exist, consider this optimization as "added"
    return result.rows[0]?.count === 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      DELETE FROM components 
      WHERE last_on_stock < strftime('%s', 'now', '-1 year')
    `.execute(db)
  },
}
