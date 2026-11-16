import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runLiveStockCrawl } from "../scripts/crawl-live-stock"
import { createStockCleanupQuery } from "../scripts/stock-cleanup-query"
import { insertPart, response, stockDatabase } from "./fixtures/live-stock"

async function fixture() {
  const { db, execute } = await stockDatabase()
  const directory = await mkdtemp(join(tmpdir(), "live-stock-run-test-"))
  const reportPath = join(directory, "report.json")
  insertPart(db, 1)
  db.exec(`UPDATE _jlcsearch_stock_policy SET grace_until=0;
    INSERT INTO _jlcsearch_stock_categories
      (category,subcategory,web_category,web_subcategory)
      VALUES('Switches','Slide Switches','Switches','Slide Switches');`)
  let fetches = 0
  return {
    db,
    execute,
    options: {
      env: {
        LIVE_STOCK_MAX_PAGES: "1",
        LIVE_STOCK_PAGES_PER_CATEGORY: "1",
        LIVE_STOCK_CLEANUP_MAX_PAGES: "1",
        LIVE_STOCK_REPORT_PATH: reportPath,
      },
      execute,
      createCleanupExecute: async () => execute,
      fetcher: (async () => {
        fetches++
        return response(1, [1], 99)
      }) as unknown as typeof fetch,
      cleanupPause: async () => {},
    },
    report: () => Bun.file(reportPath).json(),
    assertRefreshed: () => {
      expect(fetches).toBeGreaterThan(0)
      for (const table of ["component_catalog", "search_index", "switch"])
        expect(
          db.query(`SELECT stock FROM "${table}" WHERE lcsc=1`).get(),
        ).toEqual({ stock: 99 })
    },
    close: async () => {
      db.close()
      await rm(directory, { recursive: true, force: true })
    },
  }
}

test.each(["client initialization", "exhausted query retries"])(
  "%s failure is reported after the live crawl and coverage report finish",
  async (failure) => {
    const f = await fixture()
    let attempts = 0
    const delays: number[] = []
    try {
      await expect(
        runLiveStockCrawl({
          ...f.options,
          createCleanupExecute: async () => {
            if (failure === "client initialization")
              throw new Error("cleanup configuration unavailable")
            return createStockCleanupQuery({
              accountId: "a".repeat(32),
              databaseId: "00000000-0000-0000-0000-000000000000",
              apiToken: "test-only",
              fetcher: (async () => {
                attempts++
                return Response.json(
                  {
                    success: false,
                    errors: [{ code: 7429, message: "D1 DB is overloaded" }],
                  },
                  { status: 429 },
                )
              }) as unknown as typeof fetch,
              pause: async (ms) => {
                delays.push(ms)
              },
            })
          },
        }),
      ).rejects.toThrow("0 stock categories and 1 cleanup stages failed")
      f.assertRefreshed()
      expect(await f.report()).toMatchObject({
        pages: 1,
        checked: 1,
        failures: 0,
        unverifiedExpired: null,
        cleanup: {
          maxPages: 1,
          unverifiedStatus: "failed",
          errors: [{ stage: "unverified_stock", error: expect.any(String) }],
        },
        coverage: [{ ever_checked: 1 }],
      })
      if (failure === "exhausted query retries") {
        expect(attempts).toBe(3)
        expect(delays).toEqual([30_000, 60_000])
      }
    } finally {
      await f.close()
    }
  },
)

test("old-observation cleanup failure also leaves the live crawl able to refresh stock", async () => {
  const f = await fixture()
  try {
    await expect(
      runLiveStockCrawl({
        ...f.options,
        execute: async (sql) => {
          if (sql.includes("WHERE expired=0"))
            throw new Error("expiry unavailable")
          return f.execute(sql)
        },
      }),
    ).rejects.toThrow("1 cleanup stages failed")
    f.assertRefreshed()
    expect(await f.report()).toMatchObject({
      expired: null,
      failures: 0,
      cleanup: { errors: [{ stage: "expired_stock" }] },
    })
  } finally {
    await f.close()
  }
})

test("a failed cleanup keeps its checkpoint, crawls, and resumes from that checkpoint next run", async () => {
  const f = await fixture()
  try {
    f.db.exec(`INSERT INTO _jlcsearch_stock_cleanup_progress VALUES('component_catalog',1000,0);
      WITH RECURSIVE ids(x) AS (VALUES(1001) UNION ALL SELECT x+1 FROM ids WHERE x<2001)
      INSERT INTO component_catalog(lcsc,stock) SELECT x,10 FROM ids;`)
    await expect(
      runLiveStockCrawl({
        ...f.options,
        createCleanupExecute: async () => async (sql) => {
          if (sql.startsWith("SELECT c.lcsc"))
            throw new Error("interrupted cleanup")
          return f.execute(sql)
        },
      }),
    ).rejects.toThrow("1 cleanup stages failed")
    f.assertRefreshed()
    expect(
      f.db
        .query(
          "SELECT after_lcsc FROM _jlcsearch_stock_cleanup_progress WHERE target='component_catalog'",
        )
        .get(),
    ).toEqual({ after_lcsc: 1000 })
    const reads: string[] = []
    await runLiveStockCrawl({
      ...f.options,
      createCleanupExecute: async () => async (sql) => {
        if (sql.startsWith("SELECT c.lcsc")) reads.push(sql)
        return f.execute(sql)
      },
    })
    expect(reads).toHaveLength(1)
    expect(reads[0]).toContain("lcsc > 1000")
    expect(
      f.db
        .query(
          "SELECT after_lcsc FROM _jlcsearch_stock_cleanup_progress WHERE target='component_catalog'",
        )
        .get(),
    ).toEqual({ after_lcsc: 2000 })
    f.assertRefreshed()
    expect(await f.report()).toMatchObject({
      cleanup: { unverifiedStatus: "completed", errors: [] },
    })
  } finally {
    await f.close()
  }
})

test.each([
  ["0", 0],
  ["1", 1],
  [undefined, 5],
] as const)(
  "cleanup budget %s bounds database pages independently of website pages",
  async (budget, expected) => {
    const f = await fixture()
    let initialized = 0
    let pages = 0
    try {
      f.db.exec(`WITH RECURSIVE ids(x) AS (VALUES(2) UNION ALL SELECT x+1 FROM ids WHERE x<6001)
      INSERT INTO component_catalog(lcsc,stock) SELECT x,10 FROM ids;
      INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at)
        SELECT lcsc,stock,unixepoch() FROM component_catalog;`)
      await runLiveStockCrawl({
        ...f.options,
        env: { ...f.options.env, LIVE_STOCK_CLEANUP_MAX_PAGES: budget },
        createCleanupExecute: async () => {
          initialized++
          return async (sql) => {
            if (sql.startsWith("SELECT c.lcsc")) pages++
            return f.execute(sql)
          }
        },
      })
      expect(initialized).toBe(expected ? 1 : 0)
      expect(pages).toBe(expected)
      f.assertRefreshed()
      expect(await f.report()).toMatchObject({
        pages: 1,
        cleanup: {
          maxPages: expected,
          unverifiedStatus: expected ? "completed" : "disabled",
          errors: [],
        },
      })
      if (!expected)
        expect(
          f.db.query("SELECT * FROM _jlcsearch_stock_cleanup_progress").all(),
        ).toEqual([])
    } finally {
      await f.close()
    }
  },
)

test.each(["-1", "1.5", "1001", "NaN"])(
  "invalid cleanup budget %s fails before any database or website access",
  async (budget) => {
    let calls = 0
    const unexpected = async (): Promise<never> => {
      calls++
      throw new Error("unexpected access")
    }
    await expect(
      runLiveStockCrawl({
        env: { LIVE_STOCK_CLEANUP_MAX_PAGES: budget },
        execute: unexpected,
        createCleanupExecute: unexpected,
        fetcher: unexpected as unknown as typeof fetch,
      }),
    ).rejects.toThrow("Invalid stock cleanup page budget")
    expect(calls).toBe(0)
  },
)
