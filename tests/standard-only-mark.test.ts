import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  crawlCategory,
  fetchStockPage,
  readStandardOnlyMark,
  runWranglerWithRetry,
} from "../scripts/crawl-live-stock"
import { liveObservationUpsertSql } from "../scripts/live-stock-policy"
import { category, insertPart, stockDatabase } from "./fixtures/live-stock"

const page = (products: object[]) =>
  (async () =>
    Response.json({
      code: 200,
      data: {
        componentPageInfo: {
          total: products.length,
          list: products.map((product, index) => ({
            componentCode: `C${index + 1}`,
            componentTypeEn: "Slide Switches",
            stockCount: 10,
            ...product,
          })),
        },
      },
    })) as unknown as typeof fetch

test("reads JLCPCB's Standard-only mark from componentProductType", () => {
  expect(readStandardOnlyMark(2)).toBe(true)
  expect(readStandardOnlyMark(0)).toBe(false)
  // Unknown values and a missing field are unknown, not "either service".
  expect(readStandardOnlyMark(1)).toBeNull()
  expect(readStandardOnlyMark(undefined)).toBeNull()
})

test("stock pages carry the mark for every part", async () => {
  const result = await fetchStockPage(
    "Switches",
    "Slide Switches",
    1,
    page([{ componentProductType: 2 }, { componentProductType: 0 }, {}]),
  )
  expect(result.rows).toEqual([
    { lcsc: 1, stock: 10, is_standard_only: true },
    { lcsc: 2, stock: 10, is_standard_only: false },
    { lcsc: 3, stock: 10, is_standard_only: null },
  ])
})

test("the crawler records the mark, and an observation without it keeps it", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    for (const lcsc of [1, 2]) insertPart(db, lcsc)
    await crawlCategory({
      category: category(),
      execute,
      targets,
      maxPages: 1,
      fetcher: page([{ componentProductType: 2 }, { componentProductType: 0 }]),
    })
    const readMarks = () =>
      db
        .query(
          "SELECT lcsc, is_standard_only FROM _jlcsearch_live_stock ORDER BY lcsc",
        )
        .all()
    expect(readMarks()).toEqual([
      { lcsc: 1, is_standard_only: 1 },
      { lcsc: 2, is_standard_only: 0 },
    ])
    // A later stock observation that does not know the mark (a catalog import)
    // updates the stock but leaves the mark as it was.
    db.exec(
      liveObservationUpsertSql([
        {
          lcsc: 1,
          stock: 5,
          stock_checked_at: Math.floor(Date.now() / 1000) + 60,
        },
      ]),
    )
    expect(readMarks()).toEqual([
      { lcsc: 1, is_standard_only: 1 },
      { lcsc: 2, is_standard_only: 0 },
    ])
  } finally {
    db.close()
  }
})

test("a retried wrangler command returns only the successful attempt's output", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "wrangler-retry-"))
  const marker = path.join(directory, "failed-once")
  try {
    // Fails the first time, printing an error on stdout, then succeeds.
    const script = `if [ -f ${marker} ]; then echo '[{"success":true,"results":[]}]'; else touch ${marker}; echo 'D1 DB is overloaded'; exit 1; fi`
    const output = await runWranglerWithRetry([], {
      delayMs: 0,
      command: ["bash", "-c", script],
    })
    expect(JSON.parse(output)).toEqual([{ success: true, results: [] }])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
