import { expect, test } from "bun:test"
import { createStockSyncBatchSql } from "../scripts/generate-stock-sync-sql"
import { insertPart, stockDatabase } from "./fixtures/live-stock"

test("newer live quantities survive snapshots, older checks, expiration and the rollout cutoff", async () => {
  const { db, targets } = await stockDatabase()
  try {
    const now = Math.floor(Date.now() / 1000)
    insertPart(db, 221660)
    insertPart(db, 2)
    const apply = (rows: Parameters<typeof createStockSyncBatchSql>[0]) =>
      db.exec(createStockSyncBatchSql(rows, targets, true))
    const zero = [{ lcsc: 221660, stock: 0, stock_checked_at: now }]
    apply(zero)
    apply(zero) // An upload whose acknowledgement was lost is safe to retry.
    apply([{ lcsc: 221660, stock: 2184 }])
    apply([{ lcsc: 221660, stock: 999, stock_checked_at: now - 60 }])
    for (const table of targets)
      expect(
        db
          .query(
            `SELECT stock, in_stock FROM "${table.name}" WHERE lcsc=221660`,
          )
          .get(),
      ).toEqual({ stock: 0, in_stock: 0 })
    apply([{ lcsc: 221660, stock: null, stock_checked_at: now + 1 }])
    apply([{ lcsc: 221660, stock: 2184 }])
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=221660").get(),
    ).toEqual({ stock: null })
    apply([{ lcsc: 221660, stock: 10, stock_checked_at: now + 2 }])
    db.exec("UPDATE _jlcsearch_live_stock SET checked_at=unixepoch()-72*3600-1")
    apply([{ lcsc: 221660, stock: 2184 }])
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=221660").get(),
    ).toEqual({ stock: null })
    apply([{ lcsc: 2, stock: 7 }])
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=2").get(),
    ).toEqual({ stock: 7 })
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    apply([{ lcsc: 2, stock: 7 }])
    expect(
      db.query("SELECT stock, in_stock FROM search_index WHERE lcsc=2").get(),
    ).toEqual({ stock: null, in_stock: 0 })
  } finally {
    db.close()
  }
})
