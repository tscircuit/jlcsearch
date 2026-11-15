import { describe, expect, test } from "bun:test"
import { writeRowsWithFallback } from "../lib/footprinter-write-fallback"

describe("writeRowsWithFallback", () => {
  test("retries a transient write before succeeding", async () => {
    let attempts = 0
    const delays: number[] = []

    const result = await writeRowsWithFallback(
      [1, 2],
      async () => {
        attempts += 1
        if (attempts === 1) throw new Error("temporary D1 failure")
      },
      {
        baseDelayMs: 5,
        sleep: async (delayMs) => {
          delays.push(delayMs)
        },
      },
    )

    expect(attempts).toBe(2)
    expect(delays).toEqual([5])
    expect(result).toEqual({ failedRows: [], retryCount: 1, splitCount: 0 })
  })

  test("splits a failed batch and preserves successful sub-batches", async () => {
    const writes: number[][] = []

    const result = await writeRowsWithFallback(
      [1, 2, 3, 4],
      async (rows) => {
        const values = [...rows]
        writes.push(values)
        if (values.length > 2) throw new Error("batch too large")
      },
      { maxAttempts: 1, fallbackBatchSize: 2, sleep: async () => {} },
    )

    expect(writes).toEqual([
      [1, 2, 3, 4],
      [1, 2],
      [3, 4],
    ])
    expect(result).toEqual({ failedRows: [], retryCount: 0, splitCount: 1 })
  })

  test("leaves a persistently failing small batch eligible", async () => {
    const result = await writeRowsWithFallback(
      [1, 2],
      async () => {
        throw new Error("D1 unavailable")
      },
      { maxAttempts: 2, baseDelayMs: 5, sleep: async () => {} },
    )

    expect(result.failedRows).toEqual([1, 2])
    expect(result.retryCount).toBe(1)
    expect(result.splitCount).toBe(0)
  })
})
