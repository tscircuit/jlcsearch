import { beforeEach, describe, expect, it } from "vitest"
import { generateCacheKey } from "../src/cache-key"
import { createSelf, createTestEnv } from "./test-env"

describe("Worker integration", () => {
  const env = createTestEnv()
  const SELF = createSelf(env)

  beforeEach(async () => {
    env.USE_D1 = "false"

    const keys = await env.CACHE_KV.list()
    for (const key of keys.keys) {
      await env.CACHE_KV.delete(key.name)
    }
  })

  it("serves /health directly from the worker", async () => {
    const response = await SELF.fetch("https://example.com/health")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(response.headers.get("x-cache")).toBeNull()
    expect(await response.json()).toEqual({ ok: true })
  })

  it("returns 405 for unsupported non-GET methods", async () => {
    const response = await SELF.fetch("https://example.com/components/list", {
      method: "POST",
      headers: { accept: "application/json" },
    })

    expect(response.status).toBe(405)
    expect(await response.json()).toEqual({
      error: {
        error_code: "method_not_allowed",
        message: "Method Not Allowed",
      },
    })
  })

  it("returns worker 404 for unknown list routes", async () => {
    env.USE_D1 = "true"

    const response = await SELF.fetch("https://example.com/not-found/list", {
      headers: { accept: "application/json" },
    })

    expect(response.status).toBe(404)
    expect(response.headers.get("x-data-source")).toBe("d1")
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        error_code: "not_found",
        message: "Not Found",
      },
    })
  })

  it("returns worker 404 for unknown non-list routes", async () => {
    env.USE_D1 = "true"

    const response = await SELF.fetch("https://example.com/nope", {
      headers: { accept: "application/json" },
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        error_code: "not_found",
        message: "Not Found",
      },
    })
  })

  it("serves cached D1 derived-table HTML from KV", async () => {
    env.USE_D1 = "true"

    const url = new URL("https://example.com/microcontrollers/list?package=QFN48")
    url.searchParams.set("__format", "html")
    const cacheKey = await generateCacheKey(url)

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        vary: "Accept",
        "x-data-source": "d1",
      },
    }
    const testBody = "<html><body>cached microcontrollers page</body></html>"

    await env.CACHE_KV.put(cacheKey, testBody, { metadata })

    const response = await SELF.fetch(
      "https://example.com/microcontrollers/list?package=QFN48",
    )

    expect(response.headers.get("x-cache")).toBe("HIT")
    expect(response.headers.get("x-data-source")).toBe("d1")
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(response.headers.get("vary")).toContain("Accept")
    expect(await response.text()).toBe(testBody)
  })

  it("serves cached custom D1 route HTML from KV", async () => {
    env.USE_D1 = "true"

    const url = new URL("https://example.com/risc_v_processors/list?package=QFN48")
    url.searchParams.set("__format", "html")
    const cacheKey = await generateCacheKey(url)

    await env.CACHE_KV.put(
      cacheKey,
      "<html><body>cached risc-v page</body></html>",
      {
        metadata: {
          cachedAt: new Date().toISOString(),
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            vary: "Accept",
            "x-data-source": "d1",
          },
        },
      },
    )

    const response = await SELF.fetch(
      "https://example.com/risc_v_processors/list?package=QFN48",
    )

    expect(response.headers.get("x-cache")).toBe("HIT")
    expect(response.headers.get("x-data-source")).toBe("d1")
    expect(await response.text()).toContain("cached risc-v page")
  })

  it("serves stale cached D1 derived-table HTML when refresh fails", async () => {
    env.USE_D1 = "true"

    const staleAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
    const url = new URL("https://example.com/microcontrollers/list?package=QFN48")
    url.searchParams.set("__format", "html")
    const cacheKey = await generateCacheKey(url)

    await env.CACHE_KV.put(
      cacheKey,
      "<html><body>stale microcontrollers page</body></html>",
      {
        metadata: {
          cachedAt: staleAt.toISOString(),
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            vary: "Accept",
            "x-data-source": "d1",
          },
        },
      },
    )

    const response = await SELF.fetch(
      "https://example.com/microcontrollers/list?package=QFN48",
    )

    expect(response.headers.get("x-cache")).toBe("STALE")
    expect(response.headers.get("x-data-source")).toBe("d1")
    expect(await response.text()).toContain("stale microcontrollers page")

    await SELF.flushWaitUntil()
  })

  it("serves cached D1 components HTML from KV", async () => {
    env.USE_D1 = "true"

    const url = new URL("https://example.com/components/list?search=TYPEC")
    url.searchParams.set("__format", "html")
    const cacheKey = await generateCacheKey(url)

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }
    const testBody = "<html><body>cached components page</body></html>"

    await env.CACHE_KV.put(cacheKey, testBody, { metadata })

    const response = await SELF.fetch(
      "https://example.com/components/list?search=TYPEC",
    )

    expect(response.headers.get("x-cache")).toBe("HIT")
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toBe(testBody)
  })

  it("serves cached D1 components JSON from KV", async () => {
    env.USE_D1 = "true"

    const url = new URL("https://example.com/components/list?search=TYPEC")
    url.searchParams.set("__format", "json")
    const cacheKey = await generateCacheKey(url)

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: { "content-type": "application/json" },
    }
    const testBody = '{"components":[{"lcsc":1}]}'

    await env.CACHE_KV.put(cacheKey, testBody, { metadata })

    const response = await SELF.fetch(
      "https://example.com/components/list?search=TYPEC",
      { headers: { accept: "application/json" } },
    )

    expect(response.headers.get("x-cache")).toBe("HIT")
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(await response.text()).toBe(testBody)
  })

  it("handles different cache key for different query params", async () => {
    env.USE_D1 = "true"

    const url1 = new URL("https://example.com/components/list?search=test")
    url1.searchParams.set("__format", "json")
    const url2 = new URL("https://example.com/components/list?search=other")
    url2.searchParams.set("__format", "json")

    const cacheKey1 = await generateCacheKey(url1)
    const cacheKey2 = await generateCacheKey(url2)

    await env.CACHE_KV.put(cacheKey1, '{"q":"test"}', {
      metadata: {
        cachedAt: new Date().toISOString(),
        status: 200,
        headers: { "content-type": "application/json" },
      },
    })

    const response1 = await SELF.fetch(
      "https://example.com/components/list?search=test",
      { headers: { accept: "application/json" } },
    )
    expect(response1.headers.get("x-cache")).toBe("HIT")
    expect(await response1.text()).toBe('{"q":"test"}')

    expect(cacheKey1).not.toBe(cacheKey2)
  })
})
