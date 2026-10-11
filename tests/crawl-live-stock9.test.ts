import { expect, test } from "bun:test"
import { crawlCategory } from "../scripts/crawl-live-stock"
import {
  category,
  insertPart,
  response,
  stockDatabase,
} from "./fixtures/live-stock"

test("duplicates within a page refresh valid quantities and invalidate completeness", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    insertPart(db, 999)
    const fetcher = (async (_url: any, init: any) => {
      if (JSON.parse(init.body).currentPage === 2)
        return response(
          200,
          Array.from({ length: 100 }, (_, i) => i + 100),
        )
      const body = await response(200, [
        ...Array.from({ length: 99 }, (_, i) => i + 1),
        1,
      ]).json()
      body.data.componentPageInfo.list[99].stockCount = 7
      return Response.json(body)
    }) as typeof fetch
    expect(
      await crawlCategory({
        category: category(),
        execute,
        targets,
        maxPages: 1,
        fetcher,
      }),
    ).toMatchObject({ checked: 99, duplicateRows: 1, complete: false })
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
    ).toMatchObject({ checked: 100, complete: false, restarted: true })
    for (const target of targets) {
      expect(
        db.query(`SELECT stock FROM "${target.name}" WHERE lcsc=1`).get(),
      ).toEqual({ stock: 7 })
      expect(
        db.query(`SELECT stock FROM "${target.name}" WHERE lcsc=999`).get(),
      ).toEqual({ stock: 2184 })
    }
    expect(
      db.query("SELECT completed_at FROM _jlcsearch_stock_categories").get(),
    ).toEqual({ completed_at: 0 })
  } finally {
    db.close()
  }
})
