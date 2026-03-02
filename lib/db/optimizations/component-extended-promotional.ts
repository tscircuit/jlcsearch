import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "col_components_is_extended_promotional",
  description:
    "Add is_extended_promotional column to components table for extended promotional parts",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM pragma_table_info('components')
      WHERE name = 'is_extended_promotional'
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column to the components table
    await sql`
      ALTER TABLE components ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)

    // Create an index for efficient filtering
    await sql`
      CREATE INDEX IF NOT EXISTS idx_components_is_extended_promotional
      ON components(is_extended_promotional)
    `.execute(db)

    // Recreate the v_components view to include the new column
    const viewResult = await sql`
      SELECT sql FROM sqlite_master WHERE type='view' AND name='v_components'
    `.execute(db)

    if (viewResult.rows.length > 0) {
      const originalSql = (viewResult.rows[0] as any).sql as string

      await sql`DROP VIEW IF EXISTS v_components`.execute(db)

      // Insert the new column reference before the FROM clause
      const fromIndex = originalSql.toUpperCase().indexOf("\nFROM")
      if (fromIndex > -1) {
        const newSql = `${originalSql.slice(0, fromIndex)},\n  components.is_extended_promotional${originalSql.slice(fromIndex)}`
        await sql.raw(newSql).execute(db)
      } else {
        // Fallback: just re-execute original if we can't parse it
        await sql.raw(originalSql).execute(db)
      }
    }
  },
}
