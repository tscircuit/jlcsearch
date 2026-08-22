import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"

interface StockRow {
  lcsc: number
  stock: number | null
  basic: number
  preferred: number
}

interface CatalogStats {
  row_count: number
  unique_lcsc_count: number
  null_lcsc_count: number
}

const STOCK_TABLES = ["component_catalog", "search_index"] as const

const integerLiteral = (value: number | null, label: string): string => {
  if (value === null) return "NULL"
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer, received ${value}`)
  }
  return String(value)
}

const createStockUpdateStatement = (
  table: (typeof STOCK_TABLES)[number],
  rows: StockRow[],
) => {
  const values = rows
    .map(
      ({ lcsc, stock, basic, preferred }) =>
        `(${integerLiteral(lcsc, "lcsc")},${integerLiteral(stock, "stock")},${integerLiteral(basic, "basic")},${integerLiteral(preferred, "preferred")})`,
    )
    .join(",")

  return `WITH component_updates(lcsc, stock, basic, preferred) AS (VALUES ${values})
UPDATE ${table} AS target
SET stock = component_updates.stock,
    basic = component_updates.basic,
    preferred = component_updates.preferred
FROM component_updates
WHERE target.lcsc = component_updates.lcsc
  AND (
    target.stock IS NOT component_updates.stock
    OR target.basic IS NOT component_updates.basic
    OR target.preferred IS NOT component_updates.preferred
  );`
}

export const createStockSyncBatchSql = (rows: StockRow[]): string => {
  if (rows.length === 0) {
    throw new Error("Cannot create an empty stock sync batch")
  }

  return STOCK_TABLES.map((table) =>
    createStockUpdateStatement(table, rows),
  ).join("\n")
}

export const writeStockSyncBatches = async ({
  sourcePath,
  outputDirectory,
  batchSize = 1000,
}: {
  sourcePath: string
  outputDirectory: string
  batchSize?: number
}) => {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer")
  }

  const resolvedSourcePath = path.resolve(sourcePath)
  const resolvedOutputDirectory = path.resolve(outputDirectory)
  if (!existsSync(resolvedSourcePath)) {
    throw new Error(`Source database does not exist: ${resolvedSourcePath}`)
  }

  await rm(resolvedOutputDirectory, { recursive: true, force: true })
  await mkdir(resolvedOutputDirectory, { recursive: true })

  const database = new Database(resolvedSourcePath, { readonly: true })
  try {
    const stats = database
      .query<CatalogStats, []>(
        `SELECT
          COUNT(*) AS row_count,
          COUNT(DISTINCT lcsc) AS unique_lcsc_count,
          COUNT(*) FILTER (WHERE lcsc IS NULL) AS null_lcsc_count
        FROM component_stock`,
      )
      .get()

    if (!stats || stats.row_count === 0) {
      throw new Error("component_stock is empty")
    }
    if (
      stats.null_lcsc_count !== 0 ||
      stats.unique_lcsc_count !== stats.row_count
    ) {
      throw new Error("component_stock.lcsc must be unique and non-null")
    }

    const rows = database
      .query<StockRow, []>(
        `SELECT lcsc, stock, basic, preferred
         FROM component_stock
         ORDER BY rowid`,
      )
      .iterate()

    let batch: StockRow[] = []
    let batchCount = 0
    for (const row of rows) {
      batch.push(row)
      if (batch.length < batchSize) continue

      batchCount += 1
      const filename = `batch-${String(batchCount).padStart(6, "0")}.sql`
      await Bun.write(
        path.join(resolvedOutputDirectory, filename),
        createStockSyncBatchSql(batch),
      )
      batch = []
    }

    if (batch.length > 0) {
      batchCount += 1
      const filename = `batch-${String(batchCount).padStart(6, "0")}.sql`
      await Bun.write(
        path.join(resolvedOutputDirectory, filename),
        createStockSyncBatchSql(batch),
      )
    }

    return { rowCount: stats.row_count, batchCount }
  } finally {
    database.close()
  }
}

const main = async () => {
  const sourcePath =
    process.env.SOURCE_DB_PATH?.trim() || path.resolve("db.sqlite3")
  const outputDirectory =
    process.env.STOCK_SYNC_OUTPUT_DIR?.trim() ||
    path.resolve(".stock-sync-batches")
  const batchSize = Number.parseInt(
    process.env.STOCK_BATCH_ROWS?.trim() || "1000",
    10,
  )

  const result = await writeStockSyncBatches({
    sourcePath,
    outputDirectory,
    batchSize,
  })
  console.log(
    `Generated ${result.batchCount} stock batches for ${result.rowCount} components.`,
  )
}

if (import.meta.main) {
  await main()
}
