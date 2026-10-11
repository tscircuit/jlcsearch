import { expect, test } from "bun:test"
import { crawlCategory } from "../scripts/crawl-live-stock"
import {
  category,
  insertPart,
  response,
  stockDatabase,
} from "./fixtures/live-stock"

test("changed category totals restart a cursor without claiming missing parts", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 999)
    const first = (async (_url: any, _init: any) =>
      response(
        120,
        Array.from({ length: 100 }, (_, i) => i + 1),
      )) as typeof fetch
    await crawlCategory({
      category: category(),
      execute,
      targets,
      maxPages: 1,
      fetcher: first,
    })
    const saved = db
      .query<ReturnType<typeof category>, []>(
        "SELECT * FROM _jlcsearch_stock_categories",
      )
      .get()!
    // The category shrank past the saved cursor, so page 2 is now empty.
    const changed = (async (_url: any, _init: any) =>
      response(50, [])) as typeof fetch
    expect(
      await crawlCategory({
        category: saved,
        execute,
        targets,
        maxPages: 1,
        fetcher: changed,
      }),
    ).toMatchObject({ complete: false, restarted: true })
    expect(
      db
        .query(
          "SELECT next_page,cycle,expected_total FROM _jlcsearch_stock_categories",
        )
        .get(),
    ).toEqual({ next_page: 1, cycle: "", expected_total: null })
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=999").get(),
    ).toEqual({ stock: 2184 })
  } finally {
    db.close()
  }
})
