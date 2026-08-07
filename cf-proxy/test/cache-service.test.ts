import { beforeEach, describe, expect, it } from "vitest"
import {
  CACHE_CONTROL_HEADER_VALUE,
  type CacheMetadata,
  isFresh,
  isUsableStale,
} from "../src/cache-entry"
import { CacheService } from "../src/cache-service"
import { createTestEnv } from "./test-env"

describe("isFresh", () => {
  it("returns true for entries less than 5 minutes old", () => {
    const now = new Date("2024-01-03T12:04:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T12:00:00Z",
      status: 200,
      headers: {},
    }
    expect(isFresh(metadata, now)).toBe(true)
  })

  it("returns false for entries 5 minutes or older", () => {
    const now = new Date("2024-01-03T12:05:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T12:00:00Z",
      status: 200,
      headers: {},
    }
    expect(isFresh(metadata, now)).toBe(false)
  })
})

describe("isUsableStale", () => {
  it("returns true for entries less than 1 day old", () => {
    const now = new Date("2024-01-03T12:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T00:00:00Z",
      status: 200,
      headers: {},
    }
    expect(isUsableStale(metadata, now)).toBe(true)
  })

  it("returns false for entries 1 day or older", () => {
    const now = new Date("2024-01-04T00:00:00Z")
    const metadata: CacheMetadata = {
      cachedAt: "2024-01-03T00:00:00Z",
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

    it("isolates entries by deployment namespace", async () => {
      const env = createTestEnv()
      const oldDeploymentCache = new CacheService(env.CACHE_KV, "old")
      const newDeploymentCache = new CacheService(env.CACHE_KV, "new")
      const url = new URL("https://example.com/test")

      await oldDeploymentCache.put(url, new Response("old response"))

      expect((await oldDeploymentCache.get(url)).type).toBe("fresh")
      expect((await newDeploymentCache.get(url)).type).toBe("miss")
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
        CACHE_CONTROL_HEADER_VALUE,
      )
      expect(response.headers.get("cache-control")).toContain("max-age=0")
      expect(response.headers.get("cache-control")).not.toContain(
        "stale-while-revalidate",
      )
      expect(response.headers.get("cache-control")).not.toContain("s-maxage")
      expect(response.headers.get("content-type")).toBe("text/plain")
      expect(response.status).toBe(200)
    })

    it("exposes the deployment cache namespace", () => {
      const env = createTestEnv()
      const versionedCache = new CacheService(env.CACHE_KV, "deployment-123")
      const entry = {
        body: "test body",
        metadata: {
          cachedAt: "2024-01-15T00:00:00Z",
          status: 200,
          headers: {},
        },
      }

      const response = versionedCache.buildResponse(entry, "HIT", null)

      expect(response.headers.get("x-cache-version")).toBe("deployment-123")
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
