import { describe, expect, it } from "vitest"
import { generateCacheKey } from "../src/cache-key"
import { D1_ROUTES, getD1RouteParams } from "../src/d1-routes"
import { createSelf, createTestEnv } from "./test-env"

const OVERLOADED =
  "D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window."

const createFixture = () => {
  const env = createTestEnv()
  const queries: string[] = []
  const state = { failReads: false, failWrites: false }
  env.USE_D1 = "true"
  env.DB = {
    prepare: (query: string) => ({
      bind: () => ({
        all: async () => {
          queries.push(query)
          if (state.failReads) throw new Error(OVERLOADED)
          return {
            results: [{ lcsc: 1, mfr: "Live part", package: "0402", stock: 5 }],
            meta: {},
          }
        },
        first: async () => null,
        run: async () => {
          if (state.failWrites) throw new Error(OVERLOADED)
          return { success: true, meta: {} }
        },
      }),
    }),
  } as unknown as D1Database
  return { env, queries, state, self: createSelf(env) }
}

const cachedBody = '{"resistors":[{"lcsc":2,"mfr":"Cached part"}]}'

const seedCache = async (
  env: ReturnType<typeof createTestEnv>,
  path: string,
  ageMinutes: number,
) => {
  const url = new URL(`https://example.com${path}`)
  url.searchParams.set("__format", "json")
  const key = await generateCacheKey(url)
  await env.CACHE_KV.put(key, cachedBody, {
    metadata: {
      cachedAt: new Date(Date.now() - ageMinutes * 60 * 1000).toISOString(),
      status: 200,
      headers: { "content-type": "application/json", "x-data-source": "d1" },
    },
  })
  return key
}

describe("cached responses when a D1 query fails", () => {
  it("returns the error when nothing was cached", async () => {
    const { self, state } = createFixture()
    state.failReads = true
    const response = await self.fetch("https://example.com/resistors/list.json")
    expect(response.status).toBe(500)
    expect(response.headers.get("x-cache")).toBe("D1-ERROR")
  })

  it("serves the last good copy after its normal lifetime has passed", async () => {
    const { env, self, state } = createFixture()
    const key = await seedCache(env, "/resistors/list.json", 3 * 60)
    state.failReads = true
    const response = await self.fetch("https://example.com/resistors/list.json")
    expect(response.status).toBe(200)
    expect(response.headers.get("x-cache")).toBe("STALE-ERROR")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-cached-at")).toBeTruthy()
    expect(await response.text()).toBe(cachedBody)
    expect(await env.CACHE_KV.get(key)).toBe(cachedBody)
  })

  it("replaces an expired copy as soon as D1 answers again", async () => {
    const { env, self } = createFixture()
    await seedCache(env, "/resistors/list.json", 3 * 60)
    const response = await self.fetch("https://example.com/resistors/list.json")
    expect(response.headers.get("x-cache")).toBe("MISS")
    expect(await response.json()).toEqual({
      resistors: [{ lcsc: 1, mfr: "Live part", package: "0402", stock: 5 }],
    })
  })

  it("does not serve a copy older than a day", async () => {
    const { env, self, state } = createFixture()
    await seedCache(env, "/resistors/list.json", 25 * 60)
    state.failReads = true
    const response = await self.fetch("https://example.com/resistors/list.json")
    expect(response.status).toBe(500)
  })

  it("keeps the cached copy when a forced refresh fails", async () => {
    const { env, self, state } = createFixture()
    const key = await seedCache(env, "/resistors/list.json", 1)
    state.failReads = true
    const response = await self.fetch(
      "https://example.com/resistors/list.json?cachebust=1",
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("x-cache")).toBe("STALE-ERROR")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.text()).toBe(cachedBody)
    expect(await env.CACHE_KV.get(key)).toBe(cachedBody)
  })

  it("answers an exact part lookup when recording its demand fails", async () => {
    const { self, state } = createFixture()
    state.failWrites = true
    const response = await self.fetch("https://example.com/api/search?q=C1")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ components: [{ lcsc: 1 }] })
  })
})

describe("query parameters and the response cache", () => {
  it("shares one cached response across unrelated query parameters", async () => {
    const { self, queries } = createFixture()
    const first = await self.fetch(
      "https://example.com/resistors/list.json?resistance=1000",
    )
    expect(first.headers.get("x-cache")).toBe("MISS")
    const second = await self.fetch(
      "https://example.com/resistors/list.json?utm_source=x&resistance=1000&probe=1",
    )
    expect(second.headers.get("x-cache")).toBe("HIT")
    expect(queries).toHaveLength(1)
  })

  it("keeps separate responses for parameters the route reads", async () => {
    const { self, queries } = createFixture()
    await self.fetch("https://example.com/resistors/list.json?resistance=1000")
    const other = await self.fetch(
      "https://example.com/resistors/list.json?resistance=2200",
    )
    expect(other.headers.get("x-cache")).toBe("MISS")
    expect(queries).toHaveLength(2)
  })

  it("lists the parameters of every D1 route", () => {
    for (const route of [...D1_ROUTES, "/api/search", "/components/list"]) {
      expect(getD1RouteParams(route), route).not.toBeNull()
    }
    expect(getD1RouteParams("/resistors/list")).toContain("resistance")
    expect(getD1RouteParams("/photo_diodes/list")).toContain("wavelength_min")
    expect(getD1RouteParams("/unknown/list")).toBeNull()
  })
})
