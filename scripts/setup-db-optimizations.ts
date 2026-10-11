import { getBunDatabaseClient, getDbClient } from "lib/db/get-db-client"
import { componentBasicIndex } from "lib/db/optimizations/component-basic-index"
import { componentCategoryIndex } from "lib/db/optimizations/component-category-index"
import { componentExtendedPromotionalColumn } from "lib/db/optimizations/component-extended-promotional-column"
import { componentInStockCategoryIndex } from "lib/db/optimizations/component-in-stock-category-index"
import { componentInStockColumn } from "lib/db/optimizations/component-in-stock-column"
import { componentPackageIndex } from "lib/db/optimizations/component-indexes"
import { componentPreferredIndex } from "lib/db/optimizations/component-preferred-index"
import { componentSearchFTS } from "lib/db/optimizations/component-search-fts"
import { componentStockIndex } from "lib/db/optimizations/component-stock-index"
import { removeStaleComponents } from "lib/db/optimizations/remove-stale-components"
import type { DbOptimizationSpec } from "lib/db/optimizations/types"

const OPTIMIZATIONS: DbOptimizationSpec[] = [
  componentExtendedPromotionalColumn,
  componentSearchFTS,
  componentPackageIndex,
  componentBasicIndex,
  componentPreferredIndex,
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

await main()
