import { Database } from "bun:sqlite"

// Rebuilding an upstream snapshot does not verify its stock. Only a successful
// live lookup writes this check time and supersedes its recovery provenance.
export function createLiveStockWriter(
  db: Database,
  checkedAt = Math.floor(Date.now() / 1000),
) {
  if (!Number.isSafeInteger(checkedAt) || checkedAt <= 0) {
    throw new Error("Invalid live stock observation time")
  }
  if (
    !db
      .query(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='component_stock'",
      )
      .get()
  ) {
    return (_lcsc: number, _stock: number | null) => {}
  }
  const columns = new Set(
    db
      .query<{ name: string }, []>("PRAGMA table_info(component_stock)")
      .all()
      .map((c) => c.name),
  )
  for (const [name, type] of [
    ["stock_source", "TEXT"],
    ["stock_checked_at", "INTEGER"],
  ]) {
    if (!columns.has(name))
      db.exec(`ALTER TABLE component_stock ADD COLUMN ${name} ${type}`)
  }
  const statement =
    db.prepare(`INSERT INTO component_stock(lcsc,stock,stock_source,stock_checked_at)
    VALUES (?,?,?,?) ON CONFLICT(lcsc) DO UPDATE SET stock=excluded.stock,
    stock_source=excluded.stock_source, stock_checked_at=excluded.stock_checked_at`)
  return (lcsc: number, stock: number | null) => {
    statement.run(
      lcsc,
      stock,
      stock === null ? "jlcpcb_live_missing" : "jlcpcb_live",
      checkedAt,
    )
  }
}
