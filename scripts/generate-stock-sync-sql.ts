import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { DERIVED_TABLES } from "../lib/db/derivedtables/setup-derived-tables"

interface StockRow {
  lcsc: number
  stock: number | null
  preferred: number
}

interface CatalogStats {
  row_count: number
  unique_lcsc_count: number
  null_lcsc_count: number
}

const STOCK_TABLES = ["component_catalog", "search_index"] as const
const MAX_BATCH_ROWS = 1000
const MAX_COMMAND_BYTES = 100_000
const PREFERRED_TABLES = new Set(
  DERIVED_TABLES.filter((table) =>
    table.extraColumns?.some((column) => column.name === "is_preferred"),
  ).map((table) => table.tableName),
)

interface SchemaColumn {
  table_name: string
  column_name: string
}

// Read metadata, never interpolate names received from the remote database.
export const STOCK_SYNC_SCHEMA_QUERY = `SELECT m.name AS table_name, p.name AS column_name
FROM sqlite_schema AS m JOIN pragma_table_info(m.name) AS p
WHERE m.type = 'table' AND p.name IN ('lcsc', 'stock', 'preferred', 'is_preferred');`

export const getDerivedPreferredTargets = (
  columns: SchemaColumn[],
): string[] => {
  const schema = new Map<string, Set<string>>()
  for (const column of columns) {
    if (
      !column ||
      typeof column.table_name !== "string" ||
      typeof column.column_name !== "string"
    ) {
      throw new Error("Invalid stock sync schema metadata")
    }
    const table = schema.get(column.table_name) ?? new Set<string>()
    table.add(column.column_name)
    schema.set(column.table_name, table)
  }
  for (const table of STOCK_TABLES) {
    for (const column of ["lcsc", "stock", "preferred"]) {
      if (!schema.get(table)?.has(column)) {
        throw new Error(`Stock sync target is missing ${table}.${column}`)
      }
    }
  }

  return [...PREFERRED_TABLES].filter((table) => {
    if (!schema.get(table)?.has("is_preferred")) return false
    if (!schema.get(table)?.has("lcsc")) {
      throw new Error(`Stock sync target is missing ${table}.lcsc`)
    }
    return true
  })
}

export const parseStockSyncSchema = (response: unknown): SchemaColumn[] => {
  if (
    !Array.isArray(response) ||
    response.length !== 1 ||
    response[0]?.success !== true ||
    !Array.isArray(response[0]?.results)
  ) {
    throw new Error("Expected one successful D1 schema query result")
  }
  const columns = response[0].results as SchemaColumn[]
  getDerivedPreferredTargets(columns)
  return columns
}

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
    .map(({ lcsc, stock, preferred }) => {
      if (preferred !== 0 && preferred !== 1) {
        throw new Error("preferred must be 0 or 1")
      }
      return `(${integerLiteral(lcsc, "lcsc")},${integerLiteral(stock, "stock")},${preferred})`
    })
    .join(",")

  return `WITH stock_updates(lcsc, stock, preferred) AS (VALUES ${values})
UPDATE ${table} AS target
SET stock = stock_updates.stock, preferred = stock_updates.preferred
FROM stock_updates
WHERE target.lcsc = stock_updates.lcsc
  AND (target.stock IS NOT stock_updates.stock
    OR target.preferred IS NOT stock_updates.preferred);`
}

const createStockSyncBatchStatements = (
  rows: StockRow[],
  derivedPreferredTargets: string[] = [],
): string[] => {
  if (rows.length === 0) {
    throw new Error("Cannot create an empty stock sync batch")
  }
  if (rows.length > MAX_BATCH_ROWS) {
    throw new Error(
      `Stock sync batches must contain at most ${MAX_BATCH_ROWS} rows`,
    )
  }

  const statements = STOCK_TABLES.map((table) =>
    createStockUpdateStatement(table, rows),
  )
  const identifiers = rows
    .map((row) => integerLiteral(row.lcsc, "lcsc"))
    .join(",")
  for (const table of derivedPreferredTargets) {
    if (!PREFERRED_TABLES.has(table)) {
      throw new Error(`Unknown preferred table: ${table}`)
    }
    // Bound derived writes to this same <=1,000-component batch. A single
    // whole-table UPDATE can exceed D1's execution limit during a large change.
    statements.push(`UPDATE ${table} AS target
SET is_preferred = catalog.preferred
FROM component_catalog AS catalog
WHERE target.lcsc = catalog.lcsc
  AND target.lcsc IN (${identifiers})
  AND target.is_preferred IS NOT catalog.preferred;`)
  }
  return statements
}

export const createStockSyncBatchSql = (
  rows: StockRow[],
  derivedPreferredTargets: string[] = [],
): string =>
  createStockSyncBatchStatements(rows, derivedPreferredTargets).join("\n")

export const writeStockSyncBatches = async ({
  sourcePath,
  outputDirectory,
  batchSize = 1000,
  targetSchema,
}: {
  sourcePath: string
  outputDirectory: string
  batchSize?: number
  targetSchema: SchemaColumn[]
}) => {
  if (
    !Number.isSafeInteger(batchSize) ||
    batchSize <= 0 ||
    batchSize > MAX_BATCH_ROWS
  ) {
    throw new Error(
      `batchSize must be an integer between 1 and ${MAX_BATCH_ROWS}`,
    )
  }
  const derivedPreferredTargets = getDerivedPreferredTargets(targetSchema)

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
        `SELECT lcsc, stock, preferred
         FROM component_stock
         ORDER BY rowid`,
      )
      .iterate()

    let batch: StockRow[] = []
    let batchCount = 0
    const writeBatch = async (batchRows: StockRow[]) => {
      let command = ""
      const flushCommand = async () => {
        if (!command) return
        batchCount += 1
        const filename = `batch-${String(batchCount).padStart(6, "0")}.sql`
        await Bun.write(path.join(resolvedOutputDirectory, filename), command)
        command = ""
      }
      for (const statement of createStockSyncBatchStatements(
        batchRows,
        derivedPreferredTargets,
      )) {
        const next = `${statement}\n`
        if (Buffer.byteLength(next) > MAX_COMMAND_BYTES) {
          throw new Error("Stock sync statement exceeds the command byte limit")
        }
        if (
          Buffer.byteLength(command) + Buffer.byteLength(next) >
          MAX_COMMAND_BYTES
        ) {
          await flushCommand()
        }
        command += next
      }
      await flushCommand()
    }
    for (const row of rows) {
      batch.push(row)
      if (batch.length < batchSize) continue

      await writeBatch(batch)
      batch = []
    }

    if (batch.length > 0) {
      await writeBatch(batch)
    }

    return { rowCount: stats.row_count, batchCount }
  } finally {
    database.close()
  }
}

const main = async () => {
  if (process.argv.includes("--schema-query")) {
    console.log(STOCK_SYNC_SCHEMA_QUERY)
    return
  }
  const sourcePath =
    process.env.SOURCE_DB_PATH?.trim() || path.resolve("db.sqlite3")
  const outputDirectory =
    process.env.STOCK_SYNC_OUTPUT_DIR?.trim() ||
    path.resolve(".stock-sync-batches")
  const batchSize = Number(process.env.STOCK_BATCH_ROWS?.trim() || "1000")
  const schemaPath = process.env.STOCK_SYNC_SCHEMA_PATH?.trim()
  if (!schemaPath) {
    throw new Error(
      "STOCK_SYNC_SCHEMA_PATH must contain the D1 schema query response",
    )
  }
  const targetSchema = parseStockSyncSchema(await Bun.file(schemaPath).json())

  const result = await writeStockSyncBatches({
    sourcePath,
    outputDirectory,
    batchSize,
    targetSchema,
  })
  console.log(
    `Generated ${result.batchCount} stock batches for ${result.rowCount} components.`,
  )
}

if (import.meta.main) {
  await main()
}
