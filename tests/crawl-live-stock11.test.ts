import { expect, test } from "bun:test"
import { crawlCategory } from "../scripts/crawl-live-stock"
import {
  category,
  insertPart,
  response,
  stockDatabase,
} from "./fixtures/live-stock"

test("a Z-prefixed upstream part does not strand the saved category cursor", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 17101)
    insertPart(db, 165876)
    const fetcher = (async (_url: any, init: any) => {
      const page = JSON.parse(init.body).currentPage
      const body = await response(
        17225,
        Array.from(
          { length: page === 172 ? 100 : 25 },
          (_, i) => (page - 1) * 100 + i + 1,
        ),
      ).json()
      if (page === 172)
        body.data.componentPageInfo.list[99].componentCode = "Z165876"
      return Response.json(body)
    }) as typeof fetch
    expect(
      await crawlCategory({
        category: { ...category(), next_page: 172, expected_total: 17225 },
        execute,
        targets,
        maxPages: 1,
        fetcher,
      }),
    ).toMatchObject({ pages: 1, checked: 99, rejectedRows: 1, complete: false })
    const saved = db
      .query<ReturnType<typeof category>, []>(
        "SELECT * FROM _jlcsearch_stock_categories",
      )
      .get()!
    expect(saved.next_page).toBe(173)
    expect(
      await crawlCategory({
        category: saved,
        execute,
        targets,
        maxPages: 1,
        fetcher,
      }),
    ).toMatchObject({ checked: 25, complete: false, restarted: true })
    for (const target of targets) {
      expect(
        db.query(`SELECT stock FROM "${target.name}" WHERE lcsc=17101`).get(),
      ).toEqual({ stock: 0 })
      expect(
        db.query(`SELECT stock FROM "${target.name}" WHERE lcsc=165876`).get(),
      ).toEqual({ stock: 2184 })
    }
    expect(
      db
        .query("SELECT lcsc FROM _jlcsearch_live_stock WHERE lcsc=165876")
        .get(),
    ).toBeNull()
  } finally {
    db.close()
  }
})
