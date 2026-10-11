import { expect, test } from "bun:test"
import {
  fetchStockPage,
  resolveStockCategory,
} from "../scripts/crawl-live-stock"
import { category, insertPart, stockDatabase } from "./fixtures/live-stock"

test("resolves exact-part website taxonomy without mistaking another search result for the part", async () => {
  const { db, execute } = await stockDatabase()
  try {
    insertPart(db, 1)
    db.exec(
      "UPDATE component_catalog SET category='Circuit Protection', subcategory='ESD And Surge Protection (TVS/ESD)'",
    )
    const source = {
      ...category(),
      category: "Circuit Protection",
      subcategory: "ESD And Surge Protection (TVS/ESD)",
    }
    const leaf = "ESD and Surge Protection (TVS/ESD)"
    const fetcher = (async (_url: any, init: any) => {
      const request = JSON.parse(init.body)
      if (request.keyword) {
        expect(request.keyword).toBe("C1")
        return Response.json({
          code: 200,
          data: {
            componentPageInfo: {
              list: [
                {
                  componentCode: "C11",
                  componentTypeEn: "Wrong",
                  firstSortName: "Wrong",
                  secondSortName: "Wrong",
                },
                {
                  componentCode: "C1",
                  componentTypeEn: leaf,
                  firstSortName: leaf,
                  secondSortName: "Circuit Protection",
                },
              ],
            },
          },
        })
      }
      expect(request.firstSortName).toBe("Circuit Protection")
      expect(request.secondSortName).toBe(leaf)
      return Response.json({
        code: 200,
        data: {
          componentPageInfo: {
            total: 1,
            list: [
              { componentCode: "C1", componentTypeEn: leaf, stockCount: 0 },
            ],
          },
        },
      })
    }) as typeof fetch
    const resolved = await resolveStockCategory(source, execute, fetcher)
    expect(resolved.subcategory).toBe(source.subcategory)
    expect(resolved.web_subcategory).toBe(leaf)
    expect(
      (
        await fetchStockPage(
          resolved.web_category!,
          resolved.web_subcategory!,
          1,
          fetcher,
        )
      ).rows,
    ).toEqual([{ lcsc: 1, stock: 0 }])
  } finally {
    db.close()
  }
})
