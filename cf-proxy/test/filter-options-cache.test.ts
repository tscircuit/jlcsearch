import { describe, expect, it, vi } from "vitest"
import type { CacheMetadata } from "../src/cache-entry"
import { generateCacheKey } from "../src/cache-key"
import { createSelf, createTestEnv } from "./test-env"

const createFixture = () => {
  const env = createTestEnv()
  const filterQueries: string[] = []
  const packages = { resistor: ["0402", "0603"], capacitor: ["0805"] }
  env.USE_D1 = "true"
  env.DB = {
    prepare: (sql: string) => ({
      bind: () => ({
        all: async () => {
          const table = sql.includes('"capacitor"') ? "capacitor" : "resistor"
          if (sql.includes("GROUP BY")) {
            filterQueries.push(sql)
            const values = sql.includes('GROUP BY "package"')
              ? packages[table]
              : ["1000"]
            return { results: values.map((value) => ({ value })), meta: {} }
          }
          return {
            results: [
              { lcsc: 1, mfr: "Test part", package: "0402", stock: 10 },
            ],
            meta: {},
          }
        },
      }),
    }),
  } as unknown as D1Database
  return { env, self: createSelf(env), filterQueries, packages }
}

describe("table filter options", () => {
  it.each([
    ["/resistors/list.json", {}],
    ["/resistors/list?json=true", {}],
    ["/resistors/list", { headers: { accept: "application/json" } }],
  ])("skips dropdown queries for JSON through %s", async (path, init) => {
    const { self, filterQueries } = createFixture()
    const response = await self.fetch(`https://example.com${path}`, init)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      resistors: [{ lcsc: 1, mfr: "Test part", package: "0402", stock: 10 }],
    })
    expect(filterQueries).toHaveLength(0)
  })

  it("reuses dropdowns across HTML searches and keeps tables separate", async () => {
    const { self, filterQueries } = createFixture()
    const first = await self.fetch(
      "https://example.com/resistors/list?resistance=1000",
    )
    expect(first.status).toBe(200)
    expect(await first.text()).toContain('value="0603"')
    expect(filterQueries).toHaveLength(2)

    const second = await self.fetch(
      "https://example.com/resistors/list?resistance=2000",
    )
    expect(second.status).toBe(200)
    expect(await second.text()).toContain('value="0603"')
    expect(filterQueries).toHaveLength(2)

    const capacitor = await self.fetch("https://example.com/capacitors/list")
    expect(capacitor.status).toBe(200)
    const html = await capacitor.text()
    expect(html).toContain('value="0805"')
    expect(html).not.toContain('value="0603"')
    expect(filterQueries).toHaveLength(4)
  })

  it("refreshes dropdowns after their 15-minute freshness window", async () => {
    const { self, env, filterQueries, packages } = createFixture()
    await self.fetch("https://example.com/resistors/list")
    const key = await generateCacheKey(
      new URL("https://example.com/_filter-options/v1/resistor"),
    )
    const entry = await env.CACHE_KV.getWithMetadata<CacheMetadata>(key)
    await env.CACHE_KV.put(key, entry.value, {
      metadata: {
        ...entry.metadata,
        cachedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      },
    })
    packages.resistor.push("1206")

    const response = await self.fetch(
      "https://example.com/resistors/list?resistance=2000",
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('value="1206"')
    expect(filterQueries).toHaveLength(4)
  })

  it.each(["/resistors/list", "/resistors/list.json"])(
    "invalidates shared dropdowns when cache-busting %s",
    async (path) => {
      const { self, filterQueries, packages } = createFixture()
      await self.fetch("https://example.com/resistors/list")
      packages.resistor.push("1206")
      const refreshed = await self.fetch(
        `https://example.com${path}?cachebust=1`,
      )
      expect(refreshed.status).toBe(200)
      const response = await self.fetch(
        "https://example.com/resistors/list?resistance=2000",
      )
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('value="1206"')
      expect(filterQueries).toHaveLength(4)
    },
  )

  it("serves dropdowns if saving their shared cache fails", async () => {
    const { self, env } = createFixture()
    const key = await generateCacheKey(
      new URL("https://example.com/_filter-options/v1/resistor"),
    )
    const put = env.CACHE_KV.put.bind(env.CACHE_KV)
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(env.CACHE_KV, "put").mockImplementation(
      async (name, value, options) => {
        if (name === key) throw new Error("KV write limit")
        await put(name, value, options)
      },
    )
    try {
      const response = await self.fetch("https://example.com/resistors/list")
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('value="0603"')
      expect(warning).toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })
})
