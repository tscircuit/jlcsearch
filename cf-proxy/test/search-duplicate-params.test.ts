import { describe, expect, it } from "vitest"
import { createSelf, createTestEnv } from "./test-env"

const createFixture = () => {
  const env = createTestEnv()
  const calls: { sql: string; values: unknown[]; method: string }[] = []
  env.USE_D1 = "true"
  env.DB = {
    prepare: (sql: string) => ({
      bind: (...values: unknown[]) => ({
        all: async () => {
          calls.push({ sql, values, method: "all" })
          return {
            results: sql.includes("FROM search_index_fts_meta")
              ? [{ value: "1" }]
              : [],
            meta: {},
          }
        },
        first: async () => {
          calls.push({ sql, values, method: "first" })
          return null
        },
        run: async () => {
          calls.push({ sql, values, method: "run" })
          return { success: true, meta: {} }
        },
      }),
    }),
  } as unknown as D1Database
  return { env, calls, self: createSelf(env) }
}

describe("repeated search parameters", () => {
  for (const [path, parameter] of [
    ["/api/search", "q"],
    ["/components/list.json", "search"],
  ]) {
    it(`validates and caches the last ${parameter} value on ${path}`, async () => {
      const { self, calls } = createFixture()
      const base = `https://example.com${path}?`
      const first = await self.fetch(
        `${base}${parameter}=dc&${parameter}=resistor`,
      )
      expect(first.status).toBe(200)
      expect(first.headers.get("x-cache")).toBe("MISS")
      const queryCount = calls.length
      expect(queryCount).toBeGreaterThan(0)

      for (const query of [
        `${parameter}=resistor`,
        `${parameter}=C1&${parameter}=resistor`,
      ]) {
        const cached = await self.fetch(`${base}${query}`)
        expect(cached.status).toBe(200)
        expect(cached.headers.get("x-cache")).toBe("HIT")
      }
      // A discarded exact-part value must not cause a stock request or bypass cache.
      expect(calls).toHaveLength(queryCount)
      expect(calls.some((call) => call.method === "run")).toBe(false)
    })

    it(`records and reads only the last exact part on ${path}`, async () => {
      const { env, self, calls } = createFixture()
      const response = await self.fetch(
        `https://example.com${path}?${parameter}=C1&${parameter}=C2`,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(
        calls
          .filter((call) => call.method === "run")
          .map((call) => call.values),
      ).toEqual([[2]])
      expect(
        calls
          .filter((call) => call.method === "first")
          .map((call) => call.values),
      ).toEqual([[2]])
      const catalogReads = calls.filter((call) => call.method === "all")
      expect(catalogReads).toHaveLength(1)
      expect(catalogReads[0].values).toEqual([2, 100])
      expect(catalogReads[0].sql).not.toContain("search_index_fts")
      expect((await env.CACHE_KV.list()).keys).toEqual([])
    })

    it(`bypasses text-search cache when the last value is an exact part on ${path}`, async () => {
      const { self, calls } = createFixture()
      const base = `https://example.com${path}?${parameter}=resistor`
      expect((await self.fetch(base)).status).toBe(200)
      calls.length = 0
      const exact = await self.fetch(`${base}&${parameter}=C2`)
      expect(exact.status).toBe(200)
      expect(exact.headers.get("cache-control")).toBe("no-store")
      expect(
        calls
          .filter((call) => call.method === "run")
          .map((call) => call.values),
      ).toEqual([[2]])
      expect(calls.some((call) => call.sql.includes("search_index_fts"))).toBe(
        false,
      )
    })
  }

  it("uses the last limit for validation, execution and cache lookup", async () => {
    const { self, calls } = createFixture()
    const base = "https://example.com/api/search?q=resistor"
    const response = await self.fetch(`${base}&limit=1001&limit=1`)
    expect(response.status).toBe(200)
    expect(calls.at(-1)?.values.at(-1)).toBe(1)
    const queryCount = calls.length
    const cached = await self.fetch(`${base}&limit=1`)
    expect(cached.headers.get("x-cache")).toBe("HIT")
    expect(calls).toHaveLength(queryCount)
  })

  it("uses the last json value for the response and its cache entry", async () => {
    const { self } = createFixture()
    const base = "https://example.com/components/list?search=resistor"
    for (const [discarded, chosen, contentType] of [
      ["false", "true", "application/json"],
      ["true", "false", "text/html"],
    ]) {
      const response = await self.fetch(
        `${base}&json=${discarded}&json=${chosen}`,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain(contentType)
      expect(response.headers.get("x-cache")).toBe("MISS")
      const cached = await self.fetch(`${base}&json=${chosen}`)
      expect(cached.headers.get("content-type")).toContain(contentType)
      expect(cached.headers.get("x-cache")).toBe("HIT")
    }
  })

  it("uses the last cachebust value to decide whether to refresh", async () => {
    const { self, calls } = createFixture()
    const base = "https://example.com/api/search?q=resistor"
    expect((await self.fetch(base)).status).toBe(200)
    const queryCount = calls.length
    const cached = await self.fetch(`${base}&cachebust=1&cachebust=0`)
    expect(cached.headers.get("x-cache")).toBe("HIT")
    expect(calls).toHaveLength(queryCount)
    const refreshed = await self.fetch(`${base}&cachebust=0&cachebust=1`)
    expect(refreshed.headers.get("x-cache")).toBe("BUST")
    expect(calls.length).toBeGreaterThan(queryCount)
  })
})
