import { describe, expect, it } from "vitest"
import { generateCacheKey, normalizeUrl } from "../src/cache-key"

describe("normalizeUrl", () => {
  it("normalizes a simple path", () => {
    const url = new URL("https://example.com/api/test")
    expect(normalizeUrl(url)).toBe("/api/test")
  })

  it("removes trailing slash from path", () => {
    const url = new URL("https://example.com/api/test/")
    expect(normalizeUrl(url)).toBe("/api/test")
  })

  it("preserves root path", () => {
    const url = new URL("https://example.com/")
    expect(normalizeUrl(url)).toBe("/")
  })

  it("sorts query parameters alphabetically", () => {
    const url = new URL("https://example.com/search?z=1&a=2&m=3")
    expect(normalizeUrl(url)).toBe("/search?a=2&m=3&z=1")
  })

  it("sorts multiple values for same key", () => {
    const url = new URL("https://example.com/search?tag=z&tag=a")
    expect(normalizeUrl(url)).toBe("/search?tag=a&tag=z")
  })

  it("handles empty query string", () => {
    const url = new URL("https://example.com/path")
    expect(normalizeUrl(url)).toBe("/path")
  })

  it("ignores origin differences", () => {
    const url1 = new URL("https://example.com/path?a=1")
    const url2 = new URL("https://other.com/path?a=1")
    expect(normalizeUrl(url1)).toBe(normalizeUrl(url2))
  })
})

describe("generateCacheKey", () => {
  it("generates a consistent hash for the same URL", async () => {
    const url = new URL("https://example.com/api/test?param=value")
    const key1 = await generateCacheKey(url)
    const key2 = await generateCacheKey(url)
    expect(key1).toBe(key2)
  })

  it("generates different hashes for different paths", async () => {
    const url1 = new URL("https://example.com/path1")
    const url2 = new URL("https://example.com/path2")
    const key1 = await generateCacheKey(url1)
    const key2 = await generateCacheKey(url2)
    expect(key1).not.toBe(key2)
  })

  it("generates same hash regardless of query param order", async () => {
    const url1 = new URL("https://example.com/search?a=1&b=2")
    const url2 = new URL("https://example.com/search?b=2&a=1")
    const key1 = await generateCacheKey(url1)
    const key2 = await generateCacheKey(url2)
    expect(key1).toBe(key2)
  })

  it("generates same hash regardless of origin", async () => {
    const url1 = new URL("https://example.com/path")
    const url2 = new URL("https://other.com/path")
    const key1 = await generateCacheKey(url1)
    const key2 = await generateCacheKey(url2)
    expect(key1).toBe(key2)
  })

  it("generates a 64 character hex string", async () => {
    const url = new URL("https://example.com/test")
    const key = await generateCacheKey(url)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })
})
