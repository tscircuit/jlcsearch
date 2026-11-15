import { expect, test, vi } from "vitest"
import { getD1RefreshCoordinator } from "../src/d1-refresh"
import {
  RESISTORS_URL,
  cachedBody,
  createFixture,
  liveBody,
  seedCache,
} from "./d1-error-fallback-fixture"

test.each(["miss", "stale", "bust"])(
  "simultaneous %s requests share one D1 read and one cache write",
  async (mode) => {
    const { env, self, queries, state } = createFixture()
    if (mode !== "miss") await seedCache(env, 20)
    let release!: () => void
    state.waitForRead = new Promise<void>((resolve) => {
      release = resolve
    })
    const coordinator = getD1RefreshCoordinator(env.CACHE_KV)
    const run = coordinator.run.bind(coordinator)
    let calls = 0
    const count = 25
    const spy = vi.spyOn(coordinator, "run").mockImplementation((...args) => {
      const pending = run(...args)
      if (++calls === count) release()
      return pending
    })
    const put = vi.spyOn(env.CACHE_KV, "put")
    try {
      const responses = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          self.fetch(
            `${RESISTORS_URL}${mode === "bust" ? "?cachebust=1" : ""}`,
            {
              headers: { origin: `https://client${i}.example` },
            },
          ),
        ),
      )
      await self.flushWaitUntil()
      expect(calls).toBe(count)
      expect(queries).toHaveLength(1)
      expect(put).toHaveBeenCalledTimes(1)
      for (const [i, response] of responses.entries()) {
        expect(response.headers.get("access-control-allow-origin")).toBe(
          `https://client${i}.example`,
        )
        expect(response.headers.get("x-cache")).toBe(
          mode === "miss" ? "MISS" : mode === "bust" ? "BUST" : "STALE",
        )
        expect(await response.json()).toEqual(
          mode === "stale" ? JSON.parse(cachedBody) : liveBody,
        )
      }
    } finally {
      release()
      spy.mockRestore()
      put.mockRestore()
    }
  },
)

test("backoff covers new keys and cachebust while preserving cached responses", async () => {
  const { env, self, state, queries } = createFixture()
  state.failReads = true
  const first = await self.fetch(RESISTORS_URL)
  expect(first.status).toBe(500)
  expect(first.headers.get("retry-after")).toBe("30")
  const paused = await self.fetch(`${RESISTORS_URL}?package=0805&cachebust=1`, {
    headers: { origin: "https://second.example" },
  })
  expect(paused.status).toBe(503)
  expect(paused.headers.get("retry-after")).toBe("30")
  expect(paused.headers.get("cache-control")).toBe("no-store")
  expect(paused.headers.get("access-control-allow-origin")).toBe(
    "https://second.example",
  )
  expect((await env.CACHE_KV.list()).keys).toEqual([])
  await seedCache(env, 180)
  const fallback = await self.fetch(RESISTORS_URL)
  expect(fallback.headers.get("x-cache")).toBe("STALE-ERROR")
  expect(await fallback.text()).toBe(cachedBody)
  await seedCache(env, 20)
  expect((await self.fetch(RESISTORS_URL)).headers.get("x-cache")).toBe("STALE")
  await self.flushWaitUntil()
  await seedCache(env, 1)
  expect((await self.fetch(RESISTORS_URL)).headers.get("x-cache")).toBe("HIT")
  expect(queries).toHaveLength(1)
})
