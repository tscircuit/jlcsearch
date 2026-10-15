import { expect, test } from "bun:test"
import { expireUnverifiedStock } from "../scripts/crawl-live-stock"
import { insertPart, stockDatabase } from "./fixtures/live-stock"

test("expires unverified legacy rows even when they survive only in a derived table", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    insertPart(db, 2)
    db.exec(
      "INSERT INTO switch VALUES (3,20,1,'Switches','Slide Switches','old'); INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at) VALUES (2,2184,unixepoch())",
    )
    expect(await expireUnverifiedStock(execute, targets)).toBe(0)
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    expect(await expireUnverifiedStock(execute, targets)).toBe(2)
    expect(await expireUnverifiedStock(execute, targets)).toBe(0)
    expect(
      db.query("SELECT lcsc,stock,in_stock FROM switch ORDER BY lcsc").all(),
    ).toEqual([
      { lcsc: 1, stock: null, in_stock: 0 },
      { lcsc: 2, stock: 2184, in_stock: 1 },
      { lcsc: 3, stock: null, in_stock: 0 },
    ])
  } finally {
    db.close()
  }
})
