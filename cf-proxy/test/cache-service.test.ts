import { beforeEach, describe, expect, it } from "vitest"
import {
  type CacheMetadata,
  KV_TTL_SECONDS,
  isFresh,
  isUsableOnError,
  isUsableStale,
} from "../src/cache-entry"
import { generateCacheKey } from "../src/cache-key"
import { CacheService } from "../src/cache-service"
import { createTestEnv } from "./test-env"

describe("isFresh", () => {
  it("returns true for entries less than 15 minutes old", () => {
    const now = new Date("2024-01-15T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-14T23:46:00Z", // 14 minutes ago
      status: 200,
      headers: {},
    }
    expect(isFresh(metadata, now)).toBe(true)
  })

  it("returns false for entries 15 minutes or older", () => {
    const now = new Date("2024-01-15T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-14T23:45:00Z", // 15 minutes ago
      status: 200,
      headers: {},
    }
    expect(isFresh(metadata, now)).toBe(false)
  })
})

describe("isUsableStale", () => {
  it("returns true for entries less than 1 hour old", () => {
    const now = new Date("2024-01-15T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-14T23:01:00Z", // 59 minutes ago
      status: 200,
      headers: {},
    }
    expect(isUsableStale(metadata, now)).toBe(true)
  })

  it("returns false for entries 1 hour or older", () => {
    const now = new Date("2024-01-15T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-14T23:00:00Z", // 1 hour ago
      status: 200,
      headers: {},
    }
    expect(isUsableStale(metadata, now)).toBe(false)
  })
})

describe("isUsableOnError", () => {
  it("allows entries less than 24 hours old and keeps them in KV that long", () => {
    const now = new Date("2024-01-15T00:00:00Z")
    const metadata = (cachedAt: string): CacheMetadata => ({
      cachedAt,
      status: 200,
      headers: {},
    })
    expect(isUsableOnError(metadata("2024-01-14T00:01:00Z"), now)).toBe(true)
    expect(isUsableOnError(metadata("2024-01-14T00:00:00Z"), now)).toBe(false)
    expect(KV_TTL_SECONDS).toBe(24 * 60 * 60)
  })
})

describe("CacheService", () => {
  let cache: CacheService
  let env: ReturnType<typeof createTestEnv>

  beforeEach(() => {
    env = createTestEnv()
    cache = new CacheService(env.CACHE_KV)
  })

  describe("get/put", () => {
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

  describe("entry age", () => {
    it.each([
      [14, "fresh"],
      [59, "stale"],
      [61, "expired"],
      [23 * 60, "expired"],
      [25 * 60, "miss"],
    ])("reports a %i minute old entry as %s", async (minutes, type) => {
      const url = new URL("https://example.com/aged")
      await env.CACHE_KV.put(await generateCacheKey(url), "body", {
        metadata: {
          cachedAt: new Date(Date.now() - minutes * 60 * 1000).toISOString(),
          status: 200,
          headers: {},
        },
      })
      expect((await cache.get(url)).type).toBe(type)
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
        "public, max-age=300, s-maxage=300, stale-while-revalidate=60, stale-if-error=300",
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
