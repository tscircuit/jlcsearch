import { expect, test } from "vitest"
import {
  RESISTORS_URL,
  cachedBody,
  createFixture,
  liveBody,
  seedCache,
} from "./d1-error-fallback-fixture"

test("a forced refresh keeps the cached copy until D1 answers", async () => {
  const { env, self, state } = createFixture()
  const key = await seedCache(env, 1)
  state.failReads = true
  const failed = await self.fetch(`${RESISTORS_URL}?cachebust=1`)
  expect(failed.status).toBe(200)
  expect(failed.headers.get("x-cache")).toBe("STALE-ERROR")
  expect(failed.headers.get("cache-control")).toBe("no-store")
  expect(await failed.text()).toBe(cachedBody)
  expect(await env.CACHE_KV.get(key)).toBe(cachedBody)

  state.failReads = false
  const refreshed = await self.fetch(`${RESISTORS_URL}?cachebust=1`)
  expect(refreshed.headers.get("x-cache")).toBe("BUST")
  expect(await refreshed.json()).toEqual(liveBody)
  expect(JSON.parse((await env.CACHE_KV.get(key))!)).toEqual(liveBody)
})
