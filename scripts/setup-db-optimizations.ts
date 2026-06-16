import { sql } from "kysely"
import {
  getBunDatabaseClient,
  getDbClient,
  resetDbClientSingleton,
} from "lib/db/get-db-client"
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

const tableExists = async (
  db: ReturnType<typeof getDbClient>,
  tableName: string,
) => {
  const result = await sql`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name=${tableName}
  `.execute(db)

  return result.rows.length > 0
}

const materializeCompatibilityTables = async (
  db: ReturnType<typeof getDbClient>,
) => {
  const hasComponents = await tableExists(db, "components")
  const hasCategories = await tableExists(db, "categories")
  const hasVComponents = await tableExists(db, "v_components")

  if (hasComponents && hasCategories) {
    return
  }

  if (!hasVComponents) {
    throw new Error(
      "Cannot materialize compatibility tables because v_components is missing",
    )
  }

  console.log("Materializing compatibility tables from v_components...")

  if (!hasComponents) {
    await sql`
      CREATE TABLE components AS
      SELECT
        lcsc,
        0 AS manufacturer_id,
        mfr,
        package,
        description,
        datasheet,
        COALESCE(joints, 0) AS joints,
        0 AS last_update,
        COALESCE(last_on_stock, 0) AS last_on_stock,
        0 AS flag,
        category_id,
        category,
        subcategory,
        manufacturer,
        COALESCE(basic, 0) AS basic,
        COALESCE(preferred, 0) AS preferred,
        COALESCE(extended_promotional, CASE WHEN COALESCE(basic, 0) = 0 AND COALESCE(preferred, 0) = 1 THEN 1 ELSE 0 END) AS extended_promotional,
        price,
        stock,
        extra
      FROM v_components
    `.execute(db)
  }

  if (!hasCategories) {
    await sql`
      CREATE TABLE categories AS
      SELECT DISTINCT
        category_id AS id,
        category,
        subcategory
      FROM v_components
      WHERE category_id IS NOT NULL
    `.execute(db)
  }
}

const OPTIMIZATIONS: DbOptimizationSpec[] = [
  componentSearchFTS,
  componentPackageIndex,
  componentBasicIndex,
  componentPreferredIndex,
  componentExtendedPromotionalColumn,
  removeStaleComponents,
  componentStockIndex,
  componentInStockColumn,
  componentCategoryIndex,
  componentInStockCategoryIndex,
]

async function main() {
  const db = getDbClient()

  await materializeCompatibilityTables(db)

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
  resetDbClientSingleton()

  const bunDb = getBunDatabaseClient()
  console.log("Running VACUUM to optimize database...")
  await bunDb.exec("VACUUM")
  console.log("VACUUM completed")
  bunDb.close()
}

main().catch(console.error)
