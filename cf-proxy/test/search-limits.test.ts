import { describe, expect, it } from "vitest"
import { generateCacheKey } from "../src/cache-key"
import { createSelf, createTestEnv } from "./test-env"

describe("search input limits", () => {
  it.each([
    "/api/search?q=resistor&limit=-1",
    "/api/search.json?q=resistor&limit=1001",
    "/api/search?q=C1&limit=-1",
    "/api/search?q=resistor&limit=100&limit=1001",
    `/api/search?q=${encodeURIComponent("电源\0连接")}`,
    "/api/search?q=C1&q=dc",
    "/api/search?q=resistor&q=dc",
    "/components/list.json?search=resistor&search=dc",
    `/components/list.json?search=${encodeURIComponent("电源\0连接")}`,
    "/api/search?q=resistor%00",
    "/api/search?q=op",
    `/api/search?q=${"a".repeat(257)}`,
    "/components/list.json?search=dc",
    "/components/list?search=dc&json=true",
  ])(
    "rejects %s without querying D1 or serving a previously cached result",
    async (path) => {
      const env = createTestEnv()
      env.USE_D1 = "true"
      let queries = 0
      env.DB = {
        prepare: () => {
          queries++
          throw new Error("Unexpected database access")
        },
      } as unknown as D1Database
      const url = new URL(`https://example.com${path}`)
      const cacheUrl = new URL(url)
      cacheUrl.search = new URLSearchParams(
        Object.fromEntries(cacheUrl.searchParams),
      ).toString()
      if (cacheUrl.pathname.startsWith("/components/list")) {
        cacheUrl.searchParams.delete("json")
        cacheUrl.searchParams.set("__format", "json")
      }
      await env.CACHE_KV.put(
        await generateCacheKey(cacheUrl),
        '{"components":[]}',
        {
          metadata: {
            cachedAt: new Date().toISOString(),
            status: 200,
            headers: { "content-type": "application/json" },
          },
        },
      )
      const self = createSelf(env)
      for (const suffix of ["", "&cachebust=1"]) {
        const response = await self.fetch(`${url}${suffix}`, {
          headers: { origin: "https://tscircuit.com" },
        })
        expect(response.status).toBe(400)
        expect(response.headers.get("cache-control")).toBe("no-store")
        expect(response.headers.get("access-control-allow-origin")).toBe(
          "https://tscircuit.com",
        )
        expect(await response.json()).toMatchObject({
          error_code: "invalid_search",
        })
      }
      expect(queries).toBe(0)
    },
  )

  it("explains how to refine a short search on the HTML page", async () => {
    const env = createTestEnv()
    env.USE_D1 = "true"
    const response = await createSelf(env).fetch(
      "https://example.com/components/list?search=dc",
    )
    expect(response.status).toBe(400)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(response.headers.get("vary")).toContain("Accept")
    expect(await response.text()).toContain("dc connector")
  })

  it.each(["8MHz", "DC", "IC"])(
    "asks for another term when %s cannot use the index alone",
    async (query) => {
      const env = createTestEnv()
      env.USE_D1 = "true"
      const self = createSelf(env)
      const json = await self.fetch(`https://example.com/api/search?q=${query}`)
      expect(json.status).toBe(400)
      expect(await json.json()).toMatchObject({
        error_code: "invalid_search",
        message: expect.stringContaining("Add another search term"),
      })
      const html = await self.fetch(
        `https://example.com/components/list?search=${query}`,
      )
      expect(html.status).toBe(400)
      expect(await html.text()).toContain("8MHz crystal")
    },
  )
})
