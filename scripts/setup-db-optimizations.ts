import { getBunDatabaseClient, getDbClient } from "lib/db/get-db-client"
import { componentStockIndex } from "lib/db/optimizations/component-stock-index"
import { componentInStockColumn } from "lib/db/optimizations/component-in-stock-column"
import { removeStaleComponents } from "lib/db/optimizations/remove-stale-components"
import { componentCategoryIndex } from "lib/db/optimizations/component-category-index"
import { componentInStockCategoryIndex } from "lib/db/optimizations/component-in-stock-category-index"
import type { DbOptimizationSpec } from "lib/db/optimizations/types"
import { componentSearchFTS } from "lib/db/optimizations/component-search-fts"
import { componentPackageIndex } from "lib/db/optimizations/component-indexes"
import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

const addKicadAndJlcPartNumberColumns: DbOptimizationSpec = {
  name: "add_kicad_jlc_part_number_columns",
  description:
    "Adds kicad_footprint and jlc_part_number columns to components table",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    try {
      const result = await sql`
        PRAGMA table_info(components)
      `.execute(db)
      const columns = (result.rows as any[]).map((row) => row.name)
      const hasNewCols =
        columns.includes("kicad_footprint") &&
        columns.includes("jlc_part_number")
      const hasOldCol = columns.includes("kicad_library")
      return hasNewCols && !hasOldCol
    } catch (e) {
      return false
    }
  },

  async execute(db: KyselyDatabaseInstance) {
    const bunDb = getBunDatabaseClient()
    try {
      bunDb.exec("ALTER TABLE components DROP COLUMN kicad_library;")
    } catch (e: any) {
      if (!e.message.includes("no such column")) {
        console.warn("Could not drop kicad_library column", e.message)
      }
    }
    try {
      bunDb.exec("ALTER TABLE components ADD COLUMN kicad_footprint TEXT;")
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) throw e
    }
    try {
      bunDb.exec("ALTER TABLE components ADD COLUMN jlc_part_number TEXT;")
    } catch (e: any) {
      if (!e.message.includes("duplicate column name")) throw e
    }
    bunDb.close()
  },
}

const OPTIMIZATIONS: DbOptimizationSpec[] = [
  addKicadAndJlcPartNumberColumns,
  componentSearchFTS,
  componentPackageIndex,
  removeStaleComponents,
  componentStockIndex,
  componentInStockColumn,
  componentCategoryIndex,
  componentInStockCategoryIndex,
]

async function main() {
  const db = getDbClient()

  for (const optimization of OPTIMIZATIONS) {
    const isAdded = await optimization.checkIfAdded(db)

    if (!isAdded) {
      console.log(`Adding optimization: ${optimization.name}`)
      console.log(`Description: ${optimization.description}`)
      await optimization.execute(db)
      console.log("Successfully added optimization")
    } else {
      console.log(`Optimization already exists: ${optimization.name}`)
    }
  }

  await db.destroy()

  const bunDb = getBunDatabaseClient()
  console.log("Running VACUUM to optimize database...")
  await bunDb.exec("VACUUM")
  console.log("VACUUM completed")
  bunDb.close()
}

main().catch(console.error)
