import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const removeStaleComponents: DbOptimizationSpec = {
  name: "remove_stale_components",
  description: "Removes components that haven't been in stock for over a year",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    // Avoid COUNT(*) on huge tables: we only need to know whether *any* stale
    // rows exist, and we can short-circuit as soon as we find one.
    const result = await sql`
      SELECT 1
      FROM components
      WHERE last_on_stock < strftime('%s', 'now', '-1 year')
      LIMIT 1
    `.execute(db)

    // If no stale components exist, consider this optimization as "added".
    return result.rows.length === 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      DELETE FROM components 
      WHERE last_on_stock < strftime('%s', 'now', '-1 year')
    `.execute(db)
  },
}
