import { expect, test } from "vitest"
import {
  RESISTORS_URL,
  cachedBody,
  createFixture,
  seedCache,
} from "./d1-error-fallback-fixture"

test("a failed D1 query falls back to a cached copy less than a day old", async () => {
  const uncached = createFixture()
  uncached.state.failReads = true
  const error = await uncached.self.fetch(RESISTORS_URL)
  expect(error.status).toBe(500)
  expect(error.headers.get("x-cache")).toBe("D1-ERROR")

  // Three hours is past the normal one-hour lifetime.
  const expired = createFixture()
  const key = await seedCache(expired.env, 3 * 60)
  expired.state.failReads = true
  const fallback = await expired.self.fetch(RESISTORS_URL)
  expect(fallback.status).toBe(200)
  expect(fallback.headers.get("x-cache")).toBe("STALE-ERROR")
  expect(fallback.headers.get("cache-control")).toBe("no-store")
  expect(fallback.headers.get("x-cached-at")).toBeTruthy()
  expect(await fallback.text()).toBe(cachedBody)
  expect(await expired.env.CACHE_KV.get(key)).toBe(cachedBody)

  const tooOld = createFixture()
  await seedCache(tooOld.env, 25 * 60)
  tooOld.state.failReads = true
  expect((await tooOld.self.fetch(RESISTORS_URL)).status).toBe(500)
})
