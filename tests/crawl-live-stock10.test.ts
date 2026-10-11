import { expect, test } from "bun:test"
import { crawlCategory } from "../scripts/crawl-live-stock"
import { category, insertPart, stockDatabase } from "./fixtures/live-stock"

test("mixed malformed rows cannot block valid stock or erase unobserved parts", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    for (const lcsc of [1, 2, 3, 4, 999]) insertPart(db, lcsc)
    const good = {
      componentCode: "C1",
      componentTypeEn: "Slide Switches",
      stockCount: 0,
    }
    const list = [
      good,
      null,
      { ...good, componentCode: "C2", stockCount: null },
      { ...good, componentCode: "C3", componentTypeEn: "Resistors" },
      { ...good, componentCode: "C4", stockCount: -1 },
      { ...good, componentCode: "bad" },
      { ...good, componentCode: "C5", stockCount: "0" },
      { ...good, componentCode: "C6", stockCount: 0.5 },
    ]
    const fetcher = (async (_url: any, _init: any) =>
      Response.json({
        code: 200,
        data: { componentPageInfo: { total: list.length, list } },
      })) as typeof fetch
    expect(
      await crawlCategory({
        category: category(),
        execute,
        targets,
        maxPages: 1,
        fetcher,
      }),
    ).toMatchObject({
      checked: 1,
      rejectedRows: 7,
      complete: false,
      restarted: true,
    })
    for (const target of targets) {
      expect(
        db.query(`SELECT stock FROM "${target.name}" WHERE lcsc=1`).get(),
      ).toEqual({ stock: 0 })
      expect(
        db
          .query(
            `SELECT lcsc,stock FROM "${target.name}" WHERE lcsc != 1 ORDER BY lcsc`,
          )
          .all(),
      ).toEqual([2, 3, 4, 999].map((lcsc) => ({ lcsc, stock: 2184 })))
    }
    expect(db.query("SELECT lcsc FROM _jlcsearch_live_stock").all()).toEqual([
      { lcsc: 1 },
    ])
  } finally {
    db.close()
  }
})
