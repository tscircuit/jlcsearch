import { expect, test } from "bun:test"
import { crawlCategory } from "../scripts/crawl-live-stock"
import {
  category,
  insertPart,
  response,
  stockDatabase,
} from "./fixtures/live-stock"

test("keeps advancing through changing large categories without inferring absence", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 999)
    await crawlCategory({
      category: category(),
      execute,
      targets,
      maxPages: 1,
      fetcher: (async (_url: any, _init: any) =>
        response(
          300,
          Array.from({ length: 100 }, (_, i) => i + 1),
        )) as typeof fetch,
    })
    const saved = db
      .query<ReturnType<typeof category>, []>(
        "SELECT * FROM _jlcsearch_stock_categories",
      )
      .get()!
    const fetcher = (async (_url: any, init: any) => {
      const page = JSON.parse(init.body).currentPage
      expect(page).toBeGreaterThan(1)
      return response(
        320,
        Array.from(
          { length: page === 4 ? 20 : 100 },
          (_, i) => (page - 1) * 100 + i + 1,
        ),
      )
    }) as typeof fetch
    expect(
      await crawlCategory({
        category: saved,
        execute,
        targets,
        maxPages: 3,
        fetcher,
      }),
    ).toMatchObject({ checked: 220, complete: false, restarted: true })
    expect(
      db.query("SELECT COUNT(*) AS count FROM _jlcsearch_live_stock").get(),
    ).toEqual({ count: 320 })
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=999").get(),
    ).toEqual({ stock: 2184 })
  } finally {
    db.close()
  }
})
