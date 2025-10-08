import { sql } from "kysely"
import { getDbClient } from "lib/db/get-db-client"

/**
 * Setup script for adding custom columns to the components table
 * This handles schema changes (adding columns), not optimizations
 */

async function setupComponentsSchema() {
  const db = getDbClient()
  const hasInStock = await checkColumnExists(db, "components", "in_stock")

  if (!hasInStock) {
    await sql`
      ALTER TABLE components 
      ADD COLUMN in_stock boolean 
      GENERATED ALWAYS AS (stock > 0)
    `.execute(db)
  }

  const hasExtendedPromotional = await checkColumnExists(
    db,
    "components",
    "is_extended_promotional",
  )

  if (!hasExtendedPromotional) {
    await sql`
      ALTER TABLE components 
      ADD COLUMN is_extended_promotional boolean DEFAULT 0
    `.execute(db)
  }

  await db.destroy()
  console.log("Components schema setup complete")
}

async function checkColumnExists(
  db: any,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const {
    rows: [row],
  } = await sql<any>`
    SELECT * FROM ${sql.raw(tableName)} LIMIT 1
  `.execute(db)

  return row && columnName in row
}

setupComponentsSchema().catch(console.error)
