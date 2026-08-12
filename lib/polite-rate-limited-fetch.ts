export class RequestDeadlineReachedError extends Error {
  constructor() {
    super("The request deadline was reached")
    this.name = "RequestDeadlineReachedError"
  }
}

export interface PoliteRateLimitedFetchMetrics {
  cooldownCount: number
  requestCount: number
  requestDurationMs: number
  throttleWaitMs: number
}

type FetchFunction = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Promise<Response>

interface PoliteRateLimitedFetchOptions {
  cooldownMs: number
  cooldownRequestsPerSecond: number
  deadline: number
  fetch: FetchFunction
  metrics: PoliteRateLimitedFetchMetrics
  onCooldown?: (cooldownMs: number, requestsPerSecond: number) => void
  requestsPerSecond: number
  signal: AbortSignal
}

const sleepWithSignal = (
  durationMs: number,
  signal: AbortSignal,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort)
      resolve()
    }, durationMs)
    const handleAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener("abort", handleAbort, { once: true })
  })

export class PoliteRateLimitedFetch {
  private blockedUntil = 0
  private currentIntervalMs: number
  private nextRequestAt = 0
  private reservationQueue: Promise<void> = Promise.resolve()

  constructor(private readonly options: PoliteRateLimitedFetchOptions) {
    this.currentIntervalMs = 1_000 / options.requestsPerSecond
  }

  private reserveRequestStart = async (): Promise<void> => {
    let releaseReservation = () => {}
    const previousReservation = this.reservationQueue
    this.reservationQueue = new Promise<void>((resolve) => {
      releaseReservation = resolve
    })

    await previousReservation
    try {
      while (true) {
        const now = Date.now()
        const readyAt = Math.max(now, this.blockedUntil, this.nextRequestAt)
        if (readyAt >= this.options.deadline) {
          throw new RequestDeadlineReachedError()
        }

        if (readyAt > now) {
          const waitStartedAt = Date.now()
          await sleepWithSignal(readyAt - now, this.options.signal)
          this.options.metrics.throttleWaitMs += Date.now() - waitStartedAt
          continue
        }

        this.nextRequestAt = now + this.currentIntervalMs
        break
      }
    } finally {
      releaseReservation()
    }
  }

  fetch = async (
    input: Parameters<typeof fetch>[0],
    init: Parameters<typeof fetch>[1] = {},
  ): Promise<Response> => {
    await this.reserveRequestStart()

    this.options.metrics.requestCount += 1
    const requestStartedAt = Date.now()
    try {
      const response = await this.options.fetch(input, init)
      if (response.status === 403) {
        const cooldownUntil = Date.now() + this.options.cooldownMs
        this.blockedUntil = Math.max(this.blockedUntil, cooldownUntil)
        this.currentIntervalMs = 1_000 / this.options.cooldownRequestsPerSecond
        this.options.metrics.cooldownCount += 1
        this.options.onCooldown?.(
          this.options.cooldownMs,
          this.options.cooldownRequestsPerSecond,
        )
      }
      return response
    } finally {
      this.options.metrics.requestDurationMs += Date.now() - requestStartedAt
    }
  }
}
