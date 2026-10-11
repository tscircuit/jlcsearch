import { expect, test } from "bun:test"
import { crawlCategory, fetchStockPage } from "../scripts/crawl-live-stock"
import { category, insertPart, stockDatabase } from "./fixtures/live-stock"

test("rejects malformed and incomplete responses without changing stock or cursor", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 221660)
    const good = {
      componentCode: "C221660",
      componentTypeEn: "Slide Switches",
      stockCount: 0,
    }
    const cases = [
      { total: 0, list: [] },
      { total: 2, list: [good] },
      { total: 1, list: [{ ...good, componentTypeEn: "Resistors" }] },
      ...[null, "0", -1, 0.5].map((stockCount) => ({
        total: 1,
        list: [{ ...good, stockCount }],
      })),
      { total: 2, list: [good, good] },
    ]
    for (const info of cases) {
      const fetcher = (async (_url: any, _init: any) =>
        Response.json({
          code: 200,
          data: { componentPageInfo: info },
        })) as typeof fetch
      await expect(
        crawlCategory({
          category: category(),
          execute,
          targets,
          maxPages: 1,
          fetcher,
        }),
      ).rejects.toThrow()
    }
    await expect(
      fetchStockPage(
        "Switches",
        "Slide Switches",
        1,
        (async (_url: any, _init: any) =>
          new Response("", { status: 429 })) as typeof fetch,
      ),
    ).rejects.toThrow("HTTP 429")
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=221660").get(),
    ).toEqual({ stock: 2184 })
    expect(
      db
        .query("SELECT COUNT(*) AS count FROM _jlcsearch_stock_categories")
        .get(),
    ).toEqual({ count: 0 })
  } finally {
    db.close()
  }
})
