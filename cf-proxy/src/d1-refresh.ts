import type { CacheEntry } from "./cache-entry"

export type D1RefreshResult =
  | { type: "success"; entry: CacheEntry }
  | {
      type: "failure"
      status: number
      body: string
      headers: Record<string, string>
    }

const OVERLOAD_BACKOFF_MS = 30_000
const MAX_IN_FLIGHT = 64

const retryLater = (seconds: number): D1RefreshResult => ({
  type: "failure",
  status: 503,
  body: JSON.stringify({
    error: "Database temporarily busy",
    message: "Please try again shortly.",
    error_code: "d1_busy",
  }),
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "retry-after": String(seconds),
    "x-data-source": "d1",
    "x-cache": "D1-ERROR",
  },
})

const isOverload = (
  result: D1RefreshResult,
): result is Extract<D1RefreshResult, { type: "failure" }> =>
  result.type === "failure" &&
  result.headers["x-cache"] === "D1-ERROR" &&
  /D1 (?:DB|database) is overloaded|Too many resources consumed within a 10 second window|\[code:\s*7429\]/i.test(
    result.body,
  )

// This protection is local to one Worker isolate. It is not a global lock or
// a database-wide traffic limit across Cloudflare locations.
export class D1RefreshCoordinator {
  private inFlight = new Map<string, Promise<D1RefreshResult>>()
  private overloadedUntil = 0

  constructor(private now: () => number = () => Date.now()) {}

  run(
    key: string,
    produce: () => Promise<D1RefreshResult>,
  ): Promise<D1RefreshResult> {
    const existing = this.inFlight.get(key)
    if (existing) return existing

    const remaining = this.overloadedUntil - this.now()
    if (remaining > 0)
      return Promise.resolve(retryLater(Math.ceil(remaining / 1000)))
    // After backoff, allow one recovery attempt before accepting a new burst.
    const recovering = this.overloadedUntil > 0
    if (
      (recovering && this.inFlight.size > 0) ||
      this.inFlight.size >= MAX_IN_FLIGHT
    )
      return Promise.resolve(retryLater(1))

    const pending = Promise.resolve()
      .then(produce)
      .then((result) => {
        if (isOverload(result)) {
          this.overloadedUntil = this.now() + OVERLOAD_BACKOFF_MS
          return {
            ...result,
            headers: {
              ...result.headers,
              "retry-after": String(OVERLOAD_BACKOFF_MS / 1000),
              "cache-control": "no-store",
            },
          }
        }
        if (recovering) this.overloadedUntil = 0
        return result
      })
      .finally(() => {
        this.inFlight.delete(key)
      })
    this.inFlight.set(key, pending)
    return pending
  }
}

const coordinators = new WeakMap<object, D1RefreshCoordinator>()

export const getD1RefreshCoordinator = (namespace: object) => {
  let coordinator = coordinators.get(namespace)
  if (!coordinator) {
    coordinator = new D1RefreshCoordinator()
    coordinators.set(namespace, coordinator)
  }
  return coordinator
}
