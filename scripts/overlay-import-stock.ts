import { Database } from "bun:sqlite"
import { createStockSyncBatchSql } from "./generate-stock-sync-sql"
import type { LiveStockRow } from "./live-stock-policy"

// Append a bounded correction to each metadata INSERT batch, before that
// batch is published. Full and derived imports use the same precedence as
// stock-only updates and cannot expose an old quantity until the next crawl.
export function overlayImportStock(
  db: Database,
  table: string,
  offset: number,
  limit: number,
) {
  if (
    !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit <= 0
  )
    throw new Error("Invalid import stock batch")
  const columns = new Set(
    db
      .query<{ name: string }, []>(`PRAGMA table_info("${table}")`)
      .all()
      .map((c) => c.name),
  )
  if (!columns.has("lcsc") || !columns.has("stock")) return ""
  const hasObservations = db
    .query(
      "SELECT 1 FROM sqlite_master WHERE name='component_stock' AND type='table'",
    )
    .get()
  const rows = db
    .query<
      LiveStockRow,
      [number, number]
    >(`SELECT t.lcsc, ${hasObservations ? "CASE WHEN o.stock_checked_at IS NOT NULL THEN o.stock ELSE t.stock END AS stock, o.stock_checked_at" : "t.stock"}
    FROM (SELECT * FROM "${table}" ORDER BY rowid LIMIT ? OFFSET ?) AS t
    ${hasObservations ? "LEFT JOIN component_stock AS o ON o.lcsc=t.lcsc" : ""}`)
    .all(limit, offset)
  return rows.length
    ? createStockSyncBatchSql(
        rows,
        [{ name: table, has_in_stock: columns.has("in_stock") ? 1 : 0 }],
        true,
      )
    : ""
}

if (import.meta.main) {
  const [source, table, offset, limit] = process.argv.slice(2)
  const db = new Database(source, { readonly: true })
  try {
    console.log(overlayImportStock(db, table, Number(offset), Number(limit)))
  } finally {
    db.close()
  }
}
