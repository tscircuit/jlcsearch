export interface LiveStockRow {
  lcsc: number
  stock: number | null
  stock_checked_at?: number | null
  category?: string | null
  subcategory?: string | null
  seen_cycle?: string | null
}

export const sqlString = (value: string | null | undefined) =>
  value == null ? "NULL" : `'${value.replaceAll("'", "''")}'`

// An expired or explicitly missing observation must remain unknown; it must
// never fall back to an older positive quantity in an imported snapshot.
export const effectiveStockSql = (lcsc: string, fallback: string) => `CASE
  WHEN EXISTS (SELECT 1 FROM _jlcsearch_live_stock WHERE lcsc = ${lcsc})
  THEN (SELECT CASE WHEN checked_at >= unixepoch() -
    (SELECT max_age_seconds FROM _jlcsearch_stock_policy WHERE id = 1)
    THEN observed_stock ELSE NULL END FROM _jlcsearch_live_stock WHERE lcsc = ${lcsc})
  WHEN unixepoch() < (SELECT grace_until FROM _jlcsearch_stock_policy WHERE id = 1)
  THEN ${fallback} ELSE NULL END`

export const liveObservationUpsertSql = (rows: LiveStockRow[]) => {
  const dated = rows.filter((row) => row.stock_checked_at != null)
  if (!dated.length) return ""
  for (const row of dated) {
    if (
      !Number.isSafeInteger(row.stock_checked_at) ||
      row.stock_checked_at! <= 0
    )
      throw new Error("Invalid live stock verification time")
  }
  const statements: string[] = []
  for (let offset = 0; offset < dated.length; offset += 200) {
    const values = dated
      .slice(offset, offset + 200)
      .map(
        (row) =>
          `(${row.lcsc},${row.stock === null ? "NULL" : row.stock},${row.stock_checked_at},${sqlString(row.category)},${sqlString(row.subcategory)},${sqlString(row.seen_cycle)})`,
      )
      .join(",")
    const statement = `INSERT INTO _jlcsearch_live_stock
    (lcsc, observed_stock, checked_at, category, subcategory, seen_cycle)
    VALUES ${values}
    ON CONFLICT(lcsc) DO UPDATE SET
      observed_stock = excluded.observed_stock,
      checked_at = excluded.checked_at,
      category = COALESCE(excluded.category, _jlcsearch_live_stock.category),
      subcategory = COALESCE(excluded.subcategory, _jlcsearch_live_stock.subcategory),
      seen_cycle = COALESCE(excluded.seen_cycle, _jlcsearch_live_stock.seen_cycle),
      expired = 0
    WHERE excluded.checked_at >= _jlcsearch_live_stock.checked_at;`
    if (Buffer.byteLength(statement) > 90_000)
      throw new Error("Live stock statement exceeds D1 size limit")
    statements.push(statement)
  }
  return statements.join("\n")
}
