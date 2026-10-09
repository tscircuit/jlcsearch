import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { mkdir, readFile, rm } from "node:fs/promises"
import path from "node:path"

interface StockRow {
  lcsc: number
  stock: number | null
}

interface CatalogStats {
  row_count: number
  unique_lcsc_count: number
  null_lcsc_count: number
}

export interface StockSyncTarget {
  name: string
  has_in_stock: number
}

const DEFAULT_STOCK_TARGETS: StockSyncTarget[] = [
  { name: "component_catalog", has_in_stock: 0 },
  { name: "search_index", has_in_stock: 0 },
]
const STOCK_BATCH_TABLE = "_jlcsearch_stock_sync_batch"

// Discover deployed tables rather than assuming every derived table exists.
export const STOCK_SYNC_TARGETS_QUERY = `SELECT tables.name,
  MAX(columns.name = 'in_stock') AS has_in_stock
FROM sqlite_master AS tables
JOIN pragma_table_info(tables.name) AS columns
WHERE tables.type = 'table'
  AND tables.name != '${STOCK_BATCH_TABLE}'
GROUP BY tables.name
HAVING MAX(columns.name = 'lcsc') = 1
  AND MAX(columns.name = 'stock') = 1
ORDER BY tables.name;`

const validateTargets = (targets: StockSyncTarget[]) => {
  if (targets.length === 0) throw new Error("No stock sync targets found")
  const names = new Set<string>()
  for (const target of targets) {
    if (
      !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(target.name) ||
      target.name === STOCK_BATCH_TABLE ||
      names.has(target.name) ||
      (target.has_in_stock !== 0 && target.has_in_stock !== 1)
    ) {
      throw new Error("Invalid stock sync target")
    }
    names.add(target.name)
  }
}

export const readStockSyncTargets = async (
  filename: string,
): Promise<StockSyncTarget[]> => {
  const result = JSON.parse(await readFile(filename, "utf8"))
  if (
    !Array.isArray(result) ||
    result.length !== 1 ||
    result[0]?.success !== true ||
    !Array.isArray(result[0]?.results)
  ) {
    throw new Error("Invalid D1 stock target discovery response")
  }
  const targets: StockSyncTarget[] = result[0].results
  if (targets.some((target) => !target || typeof target.name !== "string")) {
    throw new Error("Invalid stock sync target")
  }
  validateTargets(targets)
  for (const required of DEFAULT_STOCK_TARGETS) {
    if (!targets.some((target) => target.name === required.name)) {
      throw new Error(`Missing required stock table: ${required.name}`)
    }
  }
  return targets
}

const integerLiteral = (value: number | null, label: string): string => {
  if (value === null) return "NULL"
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer, received ${value}`)
  }
  return String(value)
}

const createStockUpdateStatement = (target: StockSyncTarget) => {
  const inStock = "CASE WHEN stock_updates.stock > 0 THEN 1 ELSE 0 END"
  const assignments = ["stock = stock_updates.stock"]
  const changes = ["target.stock IS NOT stock_updates.stock"]
  if (target.has_in_stock) {
    assignments.push(`in_stock = ${inStock}`)
    changes.push(`target.in_stock IS NOT (${inStock})`)
  }

  return `UPDATE "${target.name}" AS target
SET ${assignments.join(", ")}
FROM ${STOCK_BATCH_TABLE} AS stock_updates
WHERE target.lcsc IN (SELECT lcsc FROM ${STOCK_BATCH_TABLE})
  AND target.lcsc = stock_updates.lcsc
  AND (${changes.join(" OR ")});`
}

export const createStockSyncBatchSql = (
  rows: StockRow[],
  targets: StockSyncTarget[] = DEFAULT_STOCK_TARGETS,
): string => {
  if (rows.length === 0) {
    throw new Error("Cannot create an empty stock sync batch")
  }
  validateTargets(targets)

  const values = rows
    .map(
      ({ lcsc, stock }) =>
        `(${integerLiteral(lcsc, "lcsc")},${integerLiteral(stock, "stock")})`,
    )
    .join(",")

  // Share the values across all category updates to stay below D1 query and
  // shell argument limits. D1 does not support temporary tables. Each command
  // recreates/clears this staging table so retrying a partially applied batch
  // is safe; production sync workflows are serialized.
  return [
    `CREATE TABLE IF NOT EXISTS ${STOCK_BATCH_TABLE} (lcsc INTEGER PRIMARY KEY, stock INTEGER);`,
    `DELETE FROM ${STOCK_BATCH_TABLE};`,
    `INSERT INTO ${STOCK_BATCH_TABLE}(lcsc, stock) VALUES ${values};`,
    ...targets.map(createStockUpdateStatement),
    `DROP TABLE ${STOCK_BATCH_TABLE};`,
  ].join("\n")
}

export const writeStockSyncBatches = async ({
  sourcePath,
  outputDirectory,
  batchSize = 1000,
  targets = DEFAULT_STOCK_TARGETS,
}: {
  sourcePath: string
  outputDirectory: string
  batchSize?: number
  targets?: StockSyncTarget[]
}) => {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error("batchSize must be a positive integer")
  }
  validateTargets(targets)

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
        `SELECT lcsc, stock
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
        createStockSyncBatchSql(batch, targets),
      )
      batch = []
    }

    if (batch.length > 0) {
      batchCount += 1
      const filename = `batch-${String(batchCount).padStart(6, "0")}.sql`
      await Bun.write(
        path.join(resolvedOutputDirectory, filename),
        createStockSyncBatchSql(batch, targets),
      )
    }

    return { rowCount: stats.row_count, batchCount }
  } finally {
    database.close()
  }
}

const main = async () => {
  if (process.argv.includes("--print-targets-query")) {
    console.log(STOCK_SYNC_TARGETS_QUERY)
    return
  }
  const sourcePath =
    process.env.SOURCE_DB_PATH?.trim() || path.resolve("db.sqlite3")
  const outputDirectory =
    process.env.STOCK_SYNC_OUTPUT_DIR?.trim() ||
    path.resolve(".stock-sync-batches")
  const batchSize = Number.parseInt(
    process.env.STOCK_BATCH_ROWS?.trim() || "1000",
    10,
  )
  const targetsPath = process.env.STOCK_SYNC_TARGETS_PATH?.trim()
  const targets = targetsPath
    ? await readStockSyncTargets(targetsPath)
    : DEFAULT_STOCK_TARGETS

  const result = await writeStockSyncBatches({
    sourcePath,
    outputDirectory,
    batchSize,
    targets,
  })
  console.log(
    `Generated ${result.batchCount} stock batches for ${result.rowCount} components across ${targets.length} tables.`,
  )
}

if (import.meta.main) {
  await main()
}
