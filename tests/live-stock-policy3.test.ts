import { expect, test } from "bun:test"
import { createStockSyncBatchSql } from "../scripts/generate-stock-sync-sql"
import { stockDatabase } from "./fixtures/live-stock"

test("bounds individual D1 statements even when a live batch exceeds shell argument limits", async () => {
  const { db, targets } = await stockDatabase()
  try {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      lcsc: i + 1,
      stock: i,
      stock_checked_at: Math.floor(Date.now() / 1000),
      category: "Integrated Circuits (ICs)",
      subcategory:
        "Long website category name for multiword electronic components",
      seen_cycle: "00000000-0000-0000-0000-000000000000",
    }))
    const sql = createStockSyncBatchSql(rows, targets, true)
    expect(Buffer.byteLength(sql)).toBeGreaterThan(131072)
    for (const statement of sql.split(";"))
      expect(Buffer.byteLength(statement)).toBeLessThan(100000)
    db.exec(sql)
    expect(
      db.query("SELECT COUNT(*) AS count FROM _jlcsearch_live_stock").get(),
    ).toEqual({ count: 1000 })
  } finally {
    db.close()
  }
})
