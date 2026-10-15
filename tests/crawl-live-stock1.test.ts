import { expect, test } from "bun:test"
import { crawlCategory } from "../scripts/crawl-live-stock"
import {
  category,
  insertPart,
  response,
  stockDatabase,
} from "./fixtures/live-stock"

test("resumes large categories and marks missing stock unknown only after a complete scan", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    insertPart(db, 999)
    const fetcher = (async (_url: any, init: any) => {
      const page = JSON.parse(init.body).currentPage
      return response(
        120,
        Array.from(
          { length: page === 1 ? 100 : 20 },
          (_, i) => i + (page === 1 ? 1 : 101),
        ),
      )
    }) as typeof fetch
    expect(
      await crawlCategory({
        category: category(),
        execute,
        targets,
        maxPages: 1,
        fetcher,
      }),
    ).toMatchObject({ checked: 100, complete: false })
    expect(
      db.query("SELECT stock FROM search_index WHERE lcsc=999").get(),
    ).toEqual({ stock: 2184 })
    const saved = db
      .query<ReturnType<typeof category>, []>(
        "SELECT * FROM _jlcsearch_stock_categories",
      )
      .get()!
    expect(saved.next_page).toBe(2)
    expect(
      await crawlCategory({
        category: saved,
        execute,
        targets,
        maxPages: 1,
        fetcher,
      }),
    ).toMatchObject({ checked: 20, complete: true })
    for (const target of targets)
      expect(
        db
          .query(
            `SELECT lcsc,stock,in_stock FROM "${target.name}" ORDER BY lcsc`,
          )
          .all(),
      ).toEqual([
        { lcsc: 1, stock: 0, in_stock: 0 },
        { lcsc: 999, stock: null, in_stock: 0 },
      ])
    expect(
      db
        .query(
          "SELECT next_page, completed_at > 0 AS completed FROM _jlcsearch_stock_categories",
        )
        .get(),
    ).toEqual({ next_page: 1, completed: 1 })
  } finally {
    db.close()
  }
})
