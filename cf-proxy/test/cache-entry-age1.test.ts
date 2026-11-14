import { expect, test } from "vitest"
import { KV_TTL_SECONDS, isUsableOnError } from "../src/cache-entry"
import { generateCacheKey } from "../src/cache-key"
import { CacheService } from "../src/cache-service"
import { createTestEnv } from "./test-env"

test("cached entries stay available for error fallback for one day", async () => {
  const now = new Date("2024-01-15T00:00:00Z")
  const metadata = (cachedAt: string) => ({
    cachedAt,
    status: 200,
    headers: {},
  })
  expect(isUsableOnError(metadata("2024-01-14T00:01:00Z"), now)).toBe(true)
  expect(isUsableOnError(metadata("2024-01-14T00:00:00Z"), now)).toBe(false)
  expect(KV_TTL_SECONDS).toBe(24 * 60 * 60)

  const env = createTestEnv()
  const cache = new CacheService(env.CACHE_KV)
  const url = new URL("https://example.com/aged")
  for (const [minutes, type] of [
    [14, "fresh"],
    [59, "stale"],
    [61, "expired"],
    [23 * 60, "expired"],
    [25 * 60, "miss"],
  ] as const) {
    await env.CACHE_KV.put(await generateCacheKey(url), "body", {
      metadata: {
        cachedAt: new Date(Date.now() - minutes * 60 * 1000).toISOString(),
        status: 200,
        headers: {},
      },
    })
    expect((await cache.get(url)).type, `${minutes} minutes`).toBe(type)
  }
})
