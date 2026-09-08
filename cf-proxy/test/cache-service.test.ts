import { beforeEach, describe, expect, it } from "vitest"
import {
  type CacheMetadata,
  createMetadata,
  isFresh,
  isUsableStale,
} from "../src/cache-entry"
import { CacheService } from "../src/cache-service"
import { normalizeUrl } from "../src/cache-key"
import { createTestEnv } from "./test-env"

describe("isFresh", () => {
  it("returns true for entries less than 2 weeks old", () => {
    const now = new Date("2024-01-15T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T12:00:00Z", // 11.5 days ago
      status: 200,
      headers: {},
    }
    expect(isFresh(metadata, now)).toBe(true)
  })

  it("returns false for entries 2 weeks or older", () => {
    const now = new Date("2024-01-18T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T12:00:00Z", // 14.5 days ago
      status: 200,
      headers: {},
    }
    expect(isFresh(metadata, now)).toBe(false)
  })
})

describe("isUsableStale", () => {
  it("returns true for entries less than 1 month old", () => {
    const now = new Date("2024-01-23T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T00:00:00Z", // 20 days ago
      status: 200,
      headers: {},
    }
    expect(isUsableStale(metadata, now)).toBe(true)
  })

  it("returns false for entries 1 month or older", () => {
    const now = new Date("2024-02-03T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T00:00:00Z", // 31 days ago
      status: 200,
      headers: {},
    }
    expect(isUsableStale(metadata, now)).toBe(false)
  })
})

describe("CacheService", () => {
  let cache: CacheService

  beforeEach(() => {
    const env = createTestEnv()
    cache = new CacheService(env.CACHE_KV)
  })

  describe("get/put", () => {
    it("ignores fresh pre-promotional KV entries and caches the new response separately", async () => {
      const env = createTestEnv()
      const versionedCache = new CacheService(env.CACHE_KV)
      const url = new URL("https://example.com/components/list.json")
      // Exact previous key format: SHA-256 of normalized URL without a version.
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(normalizeUrl(url)),
      )
      const oldKey = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
      const oldResponse = new Response('{"components":[{"is_preferred":true}]}')
      await env.CACHE_KV.put(oldKey, await oldResponse.clone().text(), {
        metadata: createMetadata(oldResponse),
      })

      expect(await versionedCache.get(url)).toEqual({ type: "miss" })
      const newBody =
        '{"components":[{"is_preferred":true,"is_extended_promotional":true}]}'
      await versionedCache.put(url, new Response(newBody))
      const current = await versionedCache.get(url)
      expect(current.type).toBe("fresh")
      if (current.type !== "miss") expect(current.entry.body).toBe(newBody)
      await versionedCache.delete(url)
      expect(await versionedCache.get(url)).toEqual({ type: "miss" })
    })

    it("returns miss for uncached URL", async () => {
      const url = new URL("https://example.com/uncached")
      const result = await cache.get(url)
      expect(result.type).toBe("miss")
    })

    it("stores and retrieves cached response", async () => {
      const url = new URL("https://example.com/test")
      const response = new Response('{"data":"test"}', {
        status: 200,
        headers: { "content-type": "application/json" },
      })

      await cache.put(url, response)
      const result = await cache.get(url)

      expect(result.type).toBe("fresh")
      if (result.type === "fresh") {
        expect(result.entry.body).toBe('{"data":"test"}')
        expect(result.entry.metadata.status).toBe(200)
        expect(result.entry.metadata.headers["content-type"]).toBe(
          "application/json",
        )
      }
    })
  })

  describe("buildResponse", () => {
    it("builds response with HIT header", () => {
      const entry = {
        body: "test body",
        metadata: {
          cachedAt: "2024-01-15T00:00:00Z",
          status: 200,
          headers: { "content-type": "text/plain" },
        },
      }

      const response = cache.buildResponse(entry, "HIT", null)

      expect(response.headers.get("x-cache")).toBe("HIT")
      expect(response.headers.get("x-cached-at")).toBe("2024-01-15T00:00:00Z")
      expect(response.headers.get("cache-control")).toBe(
        "public, max-age=86400, s-maxage=86400, stale-while-revalidate=3600, stale-if-error=86400",
      )
      expect(response.headers.get("content-type")).toBe("text/plain")
      expect(response.status).toBe(200)
    })

    it("builds response with STALE header", () => {
      const entry = {
        body: "stale body",
        metadata: {
          cachedAt: "2024-01-10T00:00:00Z",
          status: 200,
          headers: {},
        },
      }

      const response = cache.buildResponse(entry, "STALE", null)

      expect(response.headers.get("x-cache")).toBe("STALE")
    })
  })
})
