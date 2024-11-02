import { sql } from "kysely"
import { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentInStockColumn: DbOptimizationSpec = {
  name: "add_components_in_stock_column",
  description: "Adds in_stock boolean column to components table derived from stock > 0",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM pragma_table_info('components')
      WHERE name='in_stock'
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column
    await sql`
      ALTER TABLE components 
      ADD COLUMN in_stock boolean 
      GENERATED ALWAYS AS (stock > 0)
    `.execute(db)

    // Create an index on the new column
    await db.schema
      .createIndex('idx_components_in_stock')
      .on('components')
      .column('in_stock')
      .execute()
  }
}
