import { describe, expect, it } from "vitest"
import { generateCacheKey } from "../src/cache-key"
import { createSelf, createTestEnv } from "./test-env"

describe("search input limits", () => {
  it.each([
    "/api/search?q=resistor&limit=-1",
    "/api/search.json?q=resistor&limit=1001",
    "/api/search?q=C1&limit=-1",
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
      await env.CACHE_KV.put(await generateCacheKey(url), '{"components":[]}', {
        metadata: {
          cachedAt: new Date().toISOString(),
          status: 200,
          headers: { "content-type": "application/json" },
        },
      })
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
    expect(await response.text()).toContain("at least 3 characters")
  })
})
