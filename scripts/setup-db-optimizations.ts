import { getBunDatabaseClient, getDbClient } from "lib/db/get-db-client"
import { sql } from "kysely"
import { componentStockIndex } from "lib/db/optimizations/component-stock-index"
import { componentInStockColumn } from "lib/db/optimizations/component-in-stock-column"
import { removeStaleComponents } from "lib/db/optimizations/remove-stale-components"
import { componentCategoryIndex } from "lib/db/optimizations/component-category-index"
import { componentInStockCategoryIndex } from "lib/db/optimizations/component-in-stock-category-index"
import { componentIsExtendedPromotionalColumn } from "lib/db/optimizations/component-is-extended-promotional-column"
import type { DbOptimizationSpec } from "lib/db/optimizations/types"
import { componentSearchFTS } from "lib/db/optimizations/component-search-fts"
import { componentPackageIndex } from "lib/db/optimizations/component-indexes"
import { componentBasicIndex } from "lib/db/optimizations/component-basic-index"
import { componentPreferredIndex } from "lib/db/optimizations/component-preferred-index"

const OPTIMIZATIONS: DbOptimizationSpec[] = [
  componentSearchFTS,
  componentPackageIndex,
  componentBasicIndex,
  componentPreferredIndex,
  removeStaleComponents,
  componentStockIndex,
  componentInStockColumn,
  componentCategoryIndex,
  componentInStockCategoryIndex,
  componentIsExtendedPromotionalColumn,
]

async function main() {
  const db = getDbClient()

  console.log("=== BEGIN SCHEMA DUMP ===")
  const tables = await sql`SELECT name FROM sqlite_master WHERE type='table'`.execute(db)
  console.log("TABLES:", tables.rows)

  if (tables.rows.some((r: any) => r.name === "jlc_components")) {
    const jlc_sample = await sql`SELECT * FROM jlc_components LIMIT 1`.execute(db)
    console.log("JLC_SAMPLE:", jlc_sample.rows)
  }
  if (tables.rows.some((r: any) => r.name === "lcsc_components")) {
    const lcsc_sample = await sql`SELECT * FROM lcsc_components LIMIT 1`.execute(db)
    console.log("LCSC_SAMPLE:", lcsc_sample.rows)
  }
  console.log("=== END SCHEMA DUMP ===")


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
