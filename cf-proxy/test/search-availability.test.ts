import { describe, expect, it } from "vitest"
import { generateCacheKey } from "../src/cache-key"
import { createSelf, createTestEnv } from "./test-env"

const unavailableMessage =
  "Text search is temporarily unavailable. Please try again shortly or search by an exact LCSC part number."

const createFixture = () => {
  const env = createTestEnv()
  const queries: string[] = []
  const state = {
    ready: "0" as string | undefined,
    missingMetadata: false,
    missingIndex: false,
  }
  env.USE_D1 = "true"
  env.DB = {
    prepare: (query: string) => ({
      bind: () => ({
        all: async () => {
          queries.push(query)
          if (query.includes("FROM search_index_fts_meta")) {
            if (state.missingMetadata) {
              throw new Error("D1_ERROR: no such table: search_index_fts_meta")
            }
            return {
              results:
                state.ready === undefined ? [] : [{ value: state.ready }],
              meta: {},
            }
          }
          if (query.includes("JOIN search_index_fts") && state.missingIndex) {
            throw new Error("D1_ERROR: no such table: search_index_fts")
          }
          return {
            results: [
              {
                lcsc: 12345,
                mfr: "STM32F401RCT6",
                package: "LQFP-64",
                description: "ARM microcontroller",
                stock: 50,
                price: "",
                price1: 2.5,
                basic: 0,
                preferred: 1,
                category: "ICs",
                subcategory: "Microcontrollers",
              },
            ],
            meta: {},
          }
        },
        first: async () => {
          queries.push(query)
          return null
        },
        run: async () => {
          queries.push(query)
          return { success: true, meta: {} }
        },
      }),
    }),
  } as unknown as D1Database
  return { env, queries, state, self: createSelf(env) }
}

const expectNoFallbackScan = (queries: string[]) => {
  expect(
    queries.filter(
      (query) =>
        query.includes("search_index.search_text LIKE") &&
        !query.includes("JOIN search_index_fts"),
    ),
  ).toEqual([])
}

const seedCache = async (
  env: ReturnType<typeof createTestEnv>,
  path: string,
  ageMinutes = 0,
) => {
  const url = new URL(`https://example.com${path}`)
  const isComponents = url.pathname.startsWith("/components/list")
  const isJson = !isComponents || url.pathname.endsWith(".json")
  if (isComponents) url.searchParams.set("__format", isJson ? "json" : "html")
  const key = await generateCacheKey(url)
  const body = isJson
    ? '{"components":[{"lcsc":12345,"mfr":"cached part"}]}'
    : "<html><body>cached search results</body></html>"
  await env.CACHE_KV.put(key, body, {
    metadata: {
      cachedAt: new Date(Date.now() - ageMinutes * 60 * 1000).toISOString(),
      status: 200,
      headers: {
        "content-type": isJson
          ? "application/json"
          : "text/html; charset=utf-8",
        "x-data-source": "d1",
      },
    },
  })
  return { key, body }
}

describe("search availability while the text index is unavailable", () => {
  it.each<[string, { headers?: Record<string, string> }]>([
    ["/api/search?q=STM32", {}],
    ["/api/search.json?q=STM32", {}],
    ["/components/list.json?search=STM32", {}],
    ["/components/list?search=STM32&json=true", {}],
    [
      "/components/list?search=STM32",
      { headers: { accept: "application/json" } },
    ],
  ])(
    "returns a retryable JSON response without scanning for %s",
    async (path, init) => {
      const { self, queries } = createFixture()
      const response = await self.fetch(`https://example.com${path}`, {
        ...init,
        headers: { ...init.headers, origin: "https://tscircuit.com" },
      })
      expect(response.status).toBe(503)
      expect(response.headers.get("content-type")).toContain("application/json")
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("retry-after")).toBe("60")
      expect(response.headers.get("x-cache")).toBe("SEARCH-UNAVAILABLE")
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://tscircuit.com",
      )
      expect(response.headers.get("vary")).toContain("Origin")
      if (path.startsWith("/components/")) {
        expect(response.headers.get("vary")).toContain("Accept")
      }
      expect(await response.json()).toEqual({
        error: "Search temporarily unavailable",
        message: unavailableMessage,
        error_code: "search_unavailable",
      })
      expect(queries).toHaveLength(1)
      expectNoFallbackScan(queries)
    },
  )

  it("returns the same recovery guidance as HTML for the components page", async () => {
    const { self, queries } = createFixture()
    const response = await self.fetch(
      "https://example.com/components/list?search=STM32",
    )
    expect(response.status).toBe(503)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(response.headers.get("retry-after")).toBe("60")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("vary")).toContain("Accept")
    expect(await response.text()).toContain(unavailableMessage)
    expectNoFallbackScan(queries)
  })

  it.each(["missing marker", "missing metadata", "missing index"])(
    "does not fall back to a scan with %s",
    async (failure) => {
      const { self, state, queries } = createFixture()
      state.ready = failure === "missing index" ? "1" : undefined
      state.missingMetadata = failure === "missing metadata"
      state.missingIndex = failure === "missing index"
      const response = await self.fetch(
        "https://example.com/api/search?q=STM32",
      )
      expect(response.status).toBe(503)
      expectNoFallbackScan(queries)
    },
  )

  it("resumes indexed search once validation marks the index ready", async () => {
    const { self, env, state, queries } = createFixture()
    const url = "https://example.com/api/search?q=STM32"
    expect((await self.fetch(url)).status).toBe(503)
    expect((await env.CACHE_KV.list()).keys).toEqual([])
    state.ready = "1"
    const response = await self.fetch(url)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      components: [{ lcsc: 12345, mfr: "STM32F401RCT6" }],
    })
    expect(
      queries.some((query) => query.includes("JOIN search_index_fts")),
    ).toBe(true)
    expectNoFallbackScan(queries)
  })

  it.each([
    "/api/search?q=STM32",
    "/components/list?search=STM32",
    "/components/list.json?search=STM32",
  ])("serves fresh cached results without querying D1 for %s", async (path) => {
    const { env, self, queries } = createFixture()
    const { body } = await seedCache(env, path)
    const response = await self.fetch(`https://example.com${path}`)
    expect(response.status).toBe(200)
    expect(response.headers.get("x-cache")).toBe("HIT")
    expect(await response.text()).toBe(body)
    expect(queries).toEqual([])
  })

  it("serves stale results and avoids a scan during background refresh", async () => {
    const { env, self, queries } = createFixture()
    const path = "/api/search?q=STM32"
    const { key, body } = await seedCache(env, path, 20)
    const response = await self.fetch(`https://example.com${path}`)
    expect(response.status).toBe(200)
    expect(response.headers.get("x-cache")).toBe("STALE")
    expect(await response.text()).toBe(body)
    await self.flushWaitUntil()
    expect(queries).toHaveLength(1)
    expectNoFallbackScan(queries)
    expect(await env.CACHE_KV.get(key)).toBe(body)
  })

  it.each([
    "/api/search?q=STM32",
    "/components/list?search=STM32",
    "/components/list.json?search=STM32",
  ])(
    "preserves cached results when cachebust cannot refresh %s",
    async (path) => {
      const { env, self, queries } = createFixture()
      const { key, body } = await seedCache(env, path, 20)
      const response = await self.fetch(
        `https://example.com${path}&cachebust=1`,
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(await response.text()).toBe(body)
      expect(await env.CACHE_KV.get(key)).toBe(body)
      expectNoFallbackScan(queries)
    },
  )

  it("does not cache an unavailable response or permit a cachebust scan", async () => {
    const { env, self, queries } = createFixture()
    for (const suffix of ["", "&cachebust=1"]) {
      const response = await self.fetch(
        `https://example.com/api/search?q=STM32${suffix}`,
      )
      expect(response.status).toBe(503)
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
    expect((await env.CACHE_KV.list()).keys).toEqual([])
    expectNoFallbackScan(queries)
  })

  it("does not serve expired cached results during recovery, including cachebust", async () => {
    const { env, self, queries } = createFixture()
    const path = "/api/search?q=STM32"
    await seedCache(env, path, 61)
    for (const suffix of ["", "&cachebust=1"]) {
      const response = await self.fetch(`https://example.com${path}${suffix}`)
      expect(response.status).toBe(503)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(await response.json()).toMatchObject({
        error_code: "search_unavailable",
      })
    }
    expectNoFallbackScan(queries)
  })

  it("replaces cached results on cachebust when the text index is ready", async () => {
    const { env, self, state, queries } = createFixture()
    const path = "/api/search?q=STM32"
    const { key, body: oldBody } = await seedCache(env, path)
    state.ready = "1"
    const response = await self.fetch(`https://example.com${path}&cachebust=1`)
    expect(response.status).toBe(200)
    expect(response.headers.get("x-cache")).toBe("BUST")
    expect(response.headers.get("cache-control")).toBe("no-store")
    const body = await response.text()
    expect(body).not.toBe(oldBody)
    expect(JSON.parse(body)).toMatchObject({
      components: [{ lcsc: 12345, mfr: "STM32F401RCT6" }],
    })
    expect(await env.CACHE_KV.get(key)).toBe(body)
    expectNoFallbackScan(queries)
  })

  it.each([
    "/api/search?q=C12345",
    "/api/search?q=12345",
    "/components/list.json?search=C12345",
  ])("keeps exact LCSC lookup available through %s", async (path) => {
    const { self, queries } = createFixture()
    const response = await self.fetch(`https://example.com${path}`)
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toMatchObject({
      components: [{ lcsc: 12345 }],
    })
    expect(queries.some((query) => query.includes("search_index_fts"))).toBe(
      false,
    )
    expectNoFallbackScan(queries)
  })

  it.each(["/api/search", "/components/list.json"])(
    "keeps browsing without text search available through %s",
    async (path) => {
      const { self, queries } = createFixture()
      const response = await self.fetch(`https://example.com${path}`)
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        components: [{ lcsc: 12345 }],
      })
      expect(queries.some((query) => query.includes("search_index_fts"))).toBe(
        false,
      )
      expectNoFallbackScan(queries)
    },
  )
})
