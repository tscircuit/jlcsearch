import { expect, test } from "vitest"
import {
  D1RefreshCoordinator,
  getD1RefreshCoordinator,
  type D1RefreshResult,
} from "../src/d1-refresh"

const success: D1RefreshResult = {
  type: "success",
  entry: {
    body: "ok",
    metadata: { status: 200, cachedAt: "2026-01-01T00:00:00Z", headers: {} },
  },
}
const failure = (body = "D1_ERROR: D1 DB is overloaded."): D1RefreshResult => ({
  type: "failure",
  status: 500,
  body,
  headers: { "x-cache": "D1-ERROR" },
})
const deferred = () => {
  let resolve!: (value: D1RefreshResult) => void
  const promise = new Promise<D1RefreshResult>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

test("concurrent callers share one result and completed requests leave no in-flight entry", async () => {
  const coordinator = new D1RefreshCoordinator()
  const gate = deferred()
  let calls = 0
  const produce = () => {
    calls++
    return gate.promise
  }
  const first = coordinator.run("same", produce)
  const requests = Array.from({ length: 100 }, () =>
    coordinator.run("same", produce),
  )
  for (const request of requests) expect(request).toBe(first)
  await Promise.resolve()
  expect(calls).toBe(1)
  gate.resolve(success)
  expect(await Promise.all(requests)).toHaveLength(100)
  await coordinator.run("same", produce)
  expect(calls).toBe(2)
})

test("overload blocks new keys, then permits one recovery attempt after 30 seconds", async () => {
  let now = 1000
  const coordinator = new D1RefreshCoordinator(() => now)
  const slow = deferred()
  const prior = coordinator.run("prior", () => slow.promise)
  await coordinator.run("overloaded", async () => failure())
  // A query already in flight succeeding must not cancel the backoff.
  slow.resolve(success)
  await prior
  let calls = 0
  const probe = deferred()
  const produce = () => {
    calls++
    return probe.promise
  }
  const blocked = await coordinator.run("new", produce)
  expect(blocked).toMatchObject({ type: "failure", status: 503 })
  if (blocked.type === "failure")
    expect(new Headers(blocked.headers).get("retry-after")).toBe("30")
  expect(calls).toBe(0)
  now += 30000
  const recovering = coordinator.run("new", produce)
  expect(coordinator.run("new", produce)).toBe(recovering)
  expect(await coordinator.run("another", produce)).toMatchObject({
    status: 503,
  })
  expect(calls).toBe(1)
  probe.resolve(success)
  await recovering
  expect(await coordinator.run("another", async () => success)).toBe(success)
})

test("a failed recovery attempt renews backoff and other errors do not start it", async () => {
  let now = 1000
  const coordinator = new D1RefreshCoordinator(() => now)
  await coordinator.run("a", async () => failure("no such table: example"))
  expect(await coordinator.run("b", async () => success)).toBe(success)
  await coordinator.run("a", async () => failure("D1 error [code: 7429]"))
  now += 30000
  await coordinator.run("a", async () => failure())
  now += 29999
  expect(await coordinator.run("b", async () => success)).toMatchObject({
    status: 503,
  })
  now++
  expect(await coordinator.run("b", async () => success)).toBe(success)
})

test("an unexpected producer failure frees its slot", async () => {
  const coordinator = new D1RefreshCoordinator()
  await expect(
    coordinator.run("a", async () => {
      throw new Error("KV failure")
    }),
  ).rejects.toThrow("KV failure")
  expect(await coordinator.run("a", async () => success)).toBe(success)
})

test("distinct in-flight work is bounded while duplicates can still join it", async () => {
  const coordinator = new D1RefreshCoordinator()
  const gate = deferred()
  const pending = Array.from({ length: 64 }, (_, i) =>
    coordinator.run(String(i), () => gate.promise),
  )
  expect(coordinator.run("0", () => gate.promise)).toBe(pending[0])
  expect(await coordinator.run("overflow", async () => success)).toMatchObject({
    status: 503,
  })
  gate.resolve(success)
  await Promise.all(pending)
  expect(await coordinator.run("overflow", async () => success)).toBe(success)
})

test("coordination is shared only within the same cache namespace object", async () => {
  const a = {},
    b = {}
  expect(getD1RefreshCoordinator(a)).toBe(getD1RefreshCoordinator(a))
  await getD1RefreshCoordinator(a).run("key", async () => failure())
  expect(await getD1RefreshCoordinator(b).run("key", async () => success)).toBe(
    success,
  )
})
