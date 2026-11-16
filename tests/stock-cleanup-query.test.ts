import { expect, test } from "bun:test"
import {
  createStockCleanupQuery,
  stockCleanupQueryFromEnv,
} from "../scripts/stock-cleanup-query"
import { expireUnverifiedStock } from "../scripts/expire-unverified-stock"
import { insertPart, stockDatabase } from "./fixtures/live-stock"

const credentials = {
  accountId: "a".repeat(32),
  databaseId: "00000000-0000-0000-0000-000000000001",
  apiToken: "local-test-only",
}
const success = (results: unknown[] = []) =>
  Response.json({
    success: true,
    result: [{ success: true, results }],
    errors: [],
  })
const failure = (status: number, code: number, message: string) =>
  Response.json(
    {
      success: false,
      errors: [{ code, message }],
    },
    { status },
  )

test("the configured production cleanup path uses /query for reads, guarded writes and checkpoints", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    const requests: { url: string; sql: string }[] = []
    const query = await stockCleanupQueryFromEnv(
      {
        CLOUDFLARE_ACCOUNT_ID: credentials.accountId,
        CLOUDFLARE_API_TOKEN: credentials.apiToken,
      },
      async (url, init) => {
        expect(init?.method).toBe("POST")
        expect(new Headers(init?.headers).get("Authorization")).toBe(
          "Bearer local-test-only",
        )
        const { sql } = JSON.parse(String(init?.body))
        requests.push({ url: String(url), sql })
        return success(await execute(sql))
      },
    )
    await expireUnverifiedStock(query, targets, 1, async () => {})
    expect(
      requests.every((r) =>
        /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[a-f0-9]{32}\/d1\/database\/[a-f0-9-]+\/query$/.test(
          r.url,
        ),
      ),
    ).toBe(true)
    expect(requests.some((r) => r.sql.startsWith("SELECT"))).toBe(true)
    expect(requests.some((r) => r.sql.startsWith("EXPLAIN QUERY PLAN"))).toBe(
      true,
    )
    expect(requests.some((r) => r.sql.startsWith("UPDATE"))).toBe(true)
    expect(
      requests.some((r) =>
        r.sql.startsWith("INSERT INTO _jlcsearch_stock_cleanup_progress"),
      ),
    ).toBe(true)
    expect(
      db.query("SELECT stock FROM component_catalog WHERE lcsc=1").get(),
    ).toEqual({ stock: null })
  } finally {
    db.close()
  }
})

test.each(["overload", "rate-limit", "server-error", "lost-reply"])(
  "cleanup retries %s with backoff and returns only the successful result",
  async (reason) => {
    let attempts = 0
    const delays: number[] = []
    const query = createStockCleanupQuery({
      ...credentials,
      pause: async (ms) => {
        delays.push(ms)
      },
      fetcher: async () => {
        if (++attempts > 1) return success([{ lcsc: 1 }])
        if (reason === "lost-reply") throw new Error("connection closed")
        return failure(
          reason === "rate-limit" ? 429 : reason === "server-error" ? 503 : 400,
          reason === "overload" ? 7429 : 1000,
          reason,
        )
      },
    })
    expect(await query("SELECT lcsc FROM component_catalog LIMIT 1")).toEqual([
      { lcsc: 1 },
    ])
    expect(delays).toEqual([30000])
    expect(attempts).toBe(2)
  },
)

test("cleanup stops after three overload attempts", async () => {
  const delays: number[] = []
  let calls = 0
  const query = createStockCleanupQuery({
    ...credentials,
    pause: async (ms) => {
      delays.push(ms)
    },
    fetcher: async () => {
      calls++
      return failure(400, 7429, "D1 DB is overloaded")
    },
  })
  await expect(query("SELECT 1")).rejects.toThrow("D1 DB is overloaded")
  expect(calls).toBe(3)
  expect(delays).toEqual([30000, 60000])
})

test.each([
  { success: true, result: [] },
  { success: true, result: [{ success: true }] },
  {
    success: true,
    result: [
      { success: true, results: [] },
      { success: false, error: "no such table" },
    ],
  },
  { success: false, errors: [{ code: 1000, message: "SQL syntax error" }] },
])(
  "malformed results or failed statements cannot acknowledge a checkpoint: %j",
  async (body) => {
    let calls = 0
    const query = createStockCleanupQuery({
      ...credentials,
      fetcher: async () => {
        calls++
        return Response.json(body)
      },
      pause: async () => {
        throw new Error("Unexpected retry")
      },
    })
    await expect(query("INSERT INTO progress VALUES(1)")).rejects.toThrow()
    expect(calls).toBe(1)
  },
)

test("a lost write reply is replayed safely and fresh stock arriving before retry is preserved", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    db.exec("UPDATE _jlcsearch_stock_policy SET grace_until=0")
    let lostReply = false
    let writes = 0
    const query = createStockCleanupQuery({
      ...credentials,
      pause: async () => {},
      fetcher: async (_url, init) => {
        const { sql } = JSON.parse(String(init?.body))
        const result = await execute(sql)
        if (sql.startsWith("UPDATE")) {
          writes++
          if (!lostReply) {
            lostReply = true
            db.exec(
              "INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at) VALUES(1,999,unixepoch())",
            )
            for (const t of targets)
              db.exec(`UPDATE "${t.name}" SET stock=999,in_stock=1`)
            throw new Error("reply lost after commit")
          }
        }
        return success(result)
      },
    })
    await expireUnverifiedStock(query, targets, 1, async () => {})
    expect(writes).toBe(2)
    for (const t of targets)
      expect(db.query(`SELECT stock FROM "${t.name}"`).get()).toEqual({
        stock: 999,
      })
    expect(
      db
        .query("SELECT count(*) AS n FROM _jlcsearch_stock_cleanup_progress")
        .get(),
    ).toEqual({ n: 1 })
  } finally {
    db.close()
  }
})

test("missing credentials and unknown databases fail before making any request", async () => {
  let calls = 0
  const fetcher = async () => {
    calls++
    return success()
  }
  await expect(stockCleanupQueryFromEnv({}, fetcher)).rejects.toThrow(
    "credentials",
  )
  await expect(
    stockCleanupQueryFromEnv({ DB_NAME: "wrong-database" }, fetcher),
  ).rejects.toThrow("No configured")
  expect(calls).toBe(0)
})
