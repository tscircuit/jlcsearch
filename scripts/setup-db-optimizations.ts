import { sql } from "kysely"
import {
  getBunDatabaseClient,
  getDbClient,
  getResolvedDbPath,
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

type CompatibilitySource = "v_components" | "component_catalog" | "search_index"

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

const resolveCompatibilitySource = async (
  db: ReturnType<typeof getDbClient>,
) => {
  if (await tableExists(db, "v_components")) return "v_components"
  if (await tableExists(db, "component_catalog")) return "component_catalog"
  if (await tableExists(db, "search_index")) return "search_index"
  return null
}

const createCategoriesTable = async (
  db: ReturnType<typeof getDbClient>,
  sourceTable: CompatibilitySource,
) => {
  await sql`
    CREATE TABLE categories AS
    SELECT
      ROW_NUMBER() OVER (ORDER BY category, subcategory) AS id,
      category,
      subcategory
    FROM (
      SELECT DISTINCT
        COALESCE(category, '') AS category,
        COALESCE(subcategory, '') AS subcategory
      FROM ${sql.id(sourceTable)}
    )
  `.execute(db)
}

const createComponentsTable = async (
  db: ReturnType<typeof getDbClient>,
  sourceTable: CompatibilitySource,
) => {
  switch (sourceTable) {
    case "v_components":
      await sql`
        CREATE TABLE components AS
        SELECT
          s.lcsc,
          0 AS manufacturer_id,
          s.mfr,
          s.package,
          s.description,
          s.datasheet,
          COALESCE(s.joints, 0) AS joints,
          0 AS last_update,
          COALESCE(s.last_on_stock, strftime('%s', 'now')) AS last_on_stock,
          0 AS flag,
          c.id AS category_id,
          c.category,
          c.subcategory,
          s.manufacturer,
          COALESCE(s.basic, 0) AS basic,
          COALESCE(s.preferred, 0) AS preferred,
          COALESCE(
            s.extended_promotional,
            CASE
              WHEN COALESCE(s.basic, 0) = 0 AND COALESCE(s.preferred, 0) = 1 THEN 1
              ELSE 0
            END,
          ) AS extended_promotional,
          s.price,
          s.stock,
          s.extra
        FROM ${sql.id(sourceTable)} AS s
        LEFT JOIN categories AS c
          ON c.category = COALESCE(s.category, '')
         AND c.subcategory = COALESCE(s.subcategory, '')
      `.execute(db)
      return
    case "component_catalog":
      await sql`
        CREATE TABLE components AS
        SELECT
          s.lcsc,
          0 AS manufacturer_id,
          s.mfr,
          s.package,
          s.description,
          NULL AS datasheet,
          0 AS joints,
          0 AS last_update,
          strftime('%s', 'now') AS last_on_stock,
          0 AS flag,
          c.id AS category_id,
          c.category,
          c.subcategory,
          NULL AS manufacturer,
          COALESCE(s.basic, 0) AS basic,
          COALESCE(s.preferred, 0) AS preferred,
          CASE
            WHEN COALESCE(s.basic, 0) = 0 AND COALESCE(s.preferred, 0) = 1 THEN 1
            ELSE 0
          END AS extended_promotional,
          s.price,
          s.stock,
          s.extra
        FROM ${sql.id(sourceTable)} AS s
        LEFT JOIN categories AS c
          ON c.category = COALESCE(s.category, '')
         AND c.subcategory = COALESCE(s.subcategory, '')
      `.execute(db)
      return
    case "search_index":
      await sql`
        CREATE TABLE components AS
        SELECT
          s.lcsc,
          0 AS manufacturer_id,
          s.mfr,
          s.package,
          s.description,
          NULL AS datasheet,
          0 AS joints,
          0 AS last_update,
          strftime('%s', 'now') AS last_on_stock,
          0 AS flag,
          c.id AS category_id,
          c.category,
          c.subcategory,
          s.manufacturer_name AS manufacturer,
          COALESCE(s.basic, 0) AS basic,
          COALESCE(s.preferred, 0) AS preferred,
          CASE
            WHEN COALESCE(s.basic, 0) = 0 AND COALESCE(s.preferred, 0) = 1 THEN 1
            ELSE 0
          END AS extended_promotional,
          s.price,
          s.stock,
          json_object(
            'manufacturer',
            json_object('name', s.manufacturer_name),
            'title',
            s.title,
            'mpn',
            s.mpn,
            'attributes',
            s.attributes
          ) AS extra
        FROM ${sql.id(sourceTable)} AS s
        LEFT JOIN categories AS c
          ON c.category = COALESCE(s.category, '')
         AND c.subcategory = COALESCE(s.subcategory, '')
      `.execute(db)
  }
}

const materializeCompatibilityTables = async (
  db: ReturnType<typeof getDbClient>,
) => {
  const hasComponents = await tableExists(db, "components")
  const hasCategories = await tableExists(db, "categories")
  const sourceTable = await resolveCompatibilitySource(db)

  if (hasComponents && hasCategories) {
    return
  }

  if (!sourceTable) {
    throw new Error(
      "Cannot materialize compatibility tables because no compatible source table was found",
    )
  }

  console.log(`Materializing compatibility tables from ${sourceTable}...`)

  if (!hasCategories) {
    await createCategoriesTable(db, sourceTable)
  }

  if (!hasComponents) {
    await createComponentsTable(db, sourceTable)
  }
}

const downloadPrebuiltDatabase = async () => {
  const token = process.env.DATABASE_DOWNLOAD_TOKEN?.trim()

  if (!token) {
    throw new Error(
      "Cannot materialize compatibility tables because no compatible source table was found and DATABASE_DOWNLOAD_TOKEN is not set",
    )
  }

  const url = `https://jlcsearch.fly.dev/database/${token}`
  console.log("Downloading prebuilt database from jlcsearch.fly.dev...")

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to download prebuilt database: ${response.status} ${response.statusText}`,
    )
  }

  await Bun.write(getResolvedDbPath(), await response.arrayBuffer())
  console.log("Prebuilt database download complete")
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
  const sourceTable = await resolveCompatibilitySource(db)

  if (!sourceTable) {
    await db.destroy()
    resetDbClientSingleton()
    await downloadPrebuiltDatabase()
    return
  }

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
