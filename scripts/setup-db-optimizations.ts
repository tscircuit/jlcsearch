import { getDbClient } from "lib/db/get-db-client"
import { componentStockIndex } from "lib/db/optimizations/component-stock-index"
import type { DbOptimizationSpec } from "lib/db/optimizations/types"

const OPTIMIZATIONS: DbOptimizationSpec[] = [componentStockIndex]

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
}

main().catch(console.error)
