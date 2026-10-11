import { expect, test } from "bun:test"
import { crawlCategory } from "../scripts/crawl-live-stock"
import {
  category,
  insertPart,
  response,
  stockDatabase,
} from "./fixtures/live-stock"

test("duplicate pages never establish completeness or erase missing parts", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 999)
    const duplicate = (async (_url: any, init: any) =>
      response(
        120,
        Array.from(
          { length: JSON.parse(init.body).currentPage === 1 ? 100 : 20 },
          (_, i) => i + 1,
        ),
      )) as typeof fetch
    expect(
      await crawlCategory({
        category: category(),
        execute,
        targets,
        maxPages: 2,
        fetcher: duplicate,
      }),
    ).toMatchObject({ complete: false, restarted: true })
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=999").get(),
    ).toEqual({ stock: 2184 })
    expect(
      db.query("SELECT completed_at FROM _jlcsearch_stock_categories").get(),
    ).toEqual({ completed_at: 0 })
  } finally {
    db.close()
  }
})
