export const D1_WRANGLER_RETRY_ATTEMPTS = 3
export const D1_WRANGLER_RETRY_BASE_DELAY_MS = 5_000
export const D1_WRITE_FALLBACK_BATCH_SIZE = 10

export interface WriteRowsWithFallbackOptions<T> {
  maxAttempts?: number
  baseDelayMs?: number
  fallbackBatchSize?: number
  sleep?: (durationMs: number) => Promise<void>
  onRetry?: (
    rows: readonly T[],
    attempt: number,
    delayMs: number,
    error: unknown,
  ) => void
  onSplit?: (rows: readonly T[], error: unknown) => void
  onFailure?: (rows: readonly T[], error: unknown) => void
}

export interface WriteRowsWithFallbackResult<T> {
  failedRows: T[]
  retryCount: number
  splitCount: number
}

const sleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs))

export const writeRowsWithFallback = async <T>(
  rows: readonly T[],
  writeRows: (rows: readonly T[]) => Promise<void>,
  options: WriteRowsWithFallbackOptions<T> = {},
): Promise<WriteRowsWithFallbackResult<T>> => {
  const maxAttempts = options.maxAttempts ?? D1_WRANGLER_RETRY_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? D1_WRANGLER_RETRY_BASE_DELAY_MS
  const fallbackBatchSize =
    options.fallbackBatchSize ?? D1_WRITE_FALLBACK_BATCH_SIZE
  const sleepFn = options.sleep ?? sleep
  const failedRows: T[] = []
  let retryCount = 0
  let splitCount = 0

  const writeBatch = async (batch: readonly T[]): Promise<void> => {
    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await writeRows(batch)
        return
      } catch (error) {
        lastError = error
        if (attempt >= maxAttempts) break

        const delayMs = baseDelayMs * 2 ** (attempt - 1)
        retryCount += 1
        options.onRetry?.(batch, attempt, delayMs, error)
        await sleepFn(delayMs)
      }
    }

    if (batch.length <= fallbackBatchSize) {
      failedRows.push(...batch)
      options.onFailure?.(batch, lastError)
      return
    }

    splitCount += 1
    options.onSplit?.(batch, lastError)
    const midpoint = Math.ceil(batch.length / 2)
    await writeBatch(batch.slice(0, midpoint))
    await writeBatch(batch.slice(midpoint))
  }

  await writeBatch(rows)

  return { failedRows, retryCount, splitCount }
}
