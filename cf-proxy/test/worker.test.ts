import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { generateCacheKey } from "../src/cache-key"
import { createSelf, createTestEnv } from "./test-env"

describe("Worker integration", () => {
  const env = createTestEnv()
  const SELF = createSelf(env)
  const originalFetch = globalThis.fetch

  beforeEach(async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("nonexistent-path-that-will-timeout")) {
        throw new Error("Simulated origin failure")
      }
      return new Response('{"status":"ok"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    // Clear the KV store between tests
    const keys = await env.CACHE_KV.list()
    for (const key of keys.keys) {
      await env.CACHE_KV.delete(key.name)
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("returns response with x-cache: HIT when entry is in cache", async () => {
    // Pre-populate cache with fresh entry
    const url = new URL("https://example.com/health")
    const cacheKey = await generateCacheKey(url)

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: { "content-type": "application/json" },
    }
    const testBody = '{"status":"ok"}'

    await env.CACHE_KV.put(cacheKey, testBody, { metadata })

    const response = await SELF.fetch("https://example.com/health")

    expect(response.headers.get("x-cache")).toBe("HIT")
    expect(response.headers.get("x-cached-at")).toBe(metadata.cachedAt)
    expect(response.status).toBe(200)

    const body = await response.text()
    expect(body).toBe(testBody)
  })

  it("returns stale cache with x-cache: STALE when entry is stale and origin fails", async () => {
    // Pre-populate with stale cache (2 days old, but within 1 week)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const url = new URL(
      "https://example.com/nonexistent-path-that-will-timeout",
    )
    const cacheKey = await generateCacheKey(url)

    const metadata = {
      cachedAt: twoDaysAgo.toISOString(),
      status: 200,
      headers: { "content-type": "application/json" },
    }
    const testBody = '{"cached":"data"}'

    await env.CACHE_KV.put(cacheKey, testBody, { metadata })

    const response = await SELF.fetch(
      "https://example.com/nonexistent-path-that-will-timeout",
      { signal: AbortSignal.timeout(15000) },
    )

    expect(response.headers.get("x-cache")).toBe("STALE")
    expect(response.status).toBe(200)
  }, 20000)

  it("refreshes stale cache in background while serving stale response", async () => {
    let fetchCount = 0
    globalThis.fetch = (async () => {
      fetchCount += 1
      return new Response('{"fresh":"data"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    const staleAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const url = new URL("https://example.com/api/search?q=abc")
    const cacheKey = await generateCacheKey(url)
    await env.CACHE_KV.put(cacheKey, '{"cached":"data"}', {
      metadata: {
        cachedAt: staleAt.toISOString(),
        status: 200,
        headers: { "content-type": "application/json" },
      },
    })

    const staleResponse = await SELF.fetch(url.toString())
    expect(staleResponse.headers.get("x-cache")).toBe("STALE")
    expect(await staleResponse.text()).toBe('{"cached":"data"}')
    expect(fetchCount).toBe(1)

    await SELF.flushWaitUntil()

    const refreshedResponse = await SELF.fetch(url.toString())
    expect(refreshedResponse.headers.get("x-cache")).toBe("HIT")
    expect(await refreshedResponse.text()).toBe('{"fresh":"data"}')
  })

  it("strips cookie header before forwarding request to origin", async () => {
    let forwardedCookie: string | null = null

    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const headers = new Headers(init?.headers)
      forwardedCookie = headers.get("cookie")
      return new Response('{"status":"ok"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    const response = await SELF.fetch("https://example.com/api/search?q=test", {
      headers: { cookie: "session=abc123", accept: "application/json" },
    })

    expect(response.status).toBe(200)
    expect(forwardedCookie).toBeNull()
  })

  it("preserves content-type header from cached response", async () => {
    const url = new URL("https://example.com/api/data")
    const cacheKey = await generateCacheKey(url)

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }
    const testBody = "<html><body>test</body></html>"

    await env.CACHE_KV.put(cacheKey, testBody, { metadata })

    const response = await SELF.fetch("https://example.com/api/data")

    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    )
    expect(response.headers.get("x-cache")).toBe("HIT")
  })

  it("handles different cache key for different query params", async () => {
    const url1 = new URL("https://example.com/search?q=test")
    const url2 = new URL("https://example.com/search?q=other")

    const cacheKey1 = await generateCacheKey(url1)
    const cacheKey2 = await generateCacheKey(url2)

    // Cache only the first URL
    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: { "content-type": "application/json" },
    }
    await env.CACHE_KV.put(cacheKey1, '{"q":"test"}', { metadata })

    // First URL should hit cache
    const response1 = await SELF.fetch("https://example.com/search?q=test")
    expect(response1.headers.get("x-cache")).toBe("HIT")
    const body1 = await response1.text()
    expect(body1).toBe('{"q":"test"}')

    // Second URL should miss cache (different key)
    // We just verify it's not returning the first cached response
    expect(cacheKey1).not.toBe(cacheKey2)
  })
})
