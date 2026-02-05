/**
 * Metadata stored alongside cached responses in KV.
 */
export interface CacheMetadata {
  cachedAt: string // ISO timestamp
  status: number
  headers: Record<string, string>
}

/**
 * A cached response entry with metadata.
 */
export interface CacheEntry {
  body: string
  metadata: CacheMetadata
}

// Cache freshness thresholds in milliseconds
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_WEEK_MS = 7 * ONE_DAY_MS

// KV TTL in seconds (1 week)
export const KV_TTL_SECONDS = 7 * 24 * 60 * 60

/**
 * Checks if a cached entry is fresh (less than 1 day old).
 */
export function isFresh(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt)
  const age = now.getTime() - cachedAt.getTime()
  return age < ONE_DAY_MS
}

/**
 * Checks if a cached entry is usable as stale (less than 1 week old).
 */
export function isUsableStale(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt)
  const age = now.getTime() - cachedAt.getTime()
  return age < ONE_WEEK_MS
}

/**
 * Creates cache metadata for a response.
 */
export function createMetadata(response: Response): CacheMetadata {
  const headers: Record<string, string> = {}
  // Preserve important headers
  const preserveHeaders = ["content-type", "content-encoding", "vary"]
  for (const header of preserveHeaders) {
    const value = response.headers.get(header)
    if (value) {
      headers[header] = value
    }
  }

  return {
    cachedAt: new Date().toISOString(),
    status: response.status,
    headers,
  }
}
