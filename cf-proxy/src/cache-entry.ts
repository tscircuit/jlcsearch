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
const FIVE_MINUTES_MS = 5 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export const CACHE_STALE_IF_ERROR_SECONDS = 24 * 60 * 60

// KV TTL in seconds (1 day)
export const KV_TTL_SECONDS = 24 * 60 * 60

export const CACHE_CONTROL_HEADER_VALUE = [
  "public",
  "max-age=0",
  "must-revalidate",
  `stale-if-error=${CACHE_STALE_IF_ERROR_SECONDS}`,
].join(", ")

/**
 * Checks if a cached entry is fresh (less than 5 minutes old).
 */
export function isFresh(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt)
  const age = now.getTime() - cachedAt.getTime()
  return age < FIVE_MINUTES_MS
}

/**
 * Checks if a cached entry is usable as stale (less than 1 day old).
 */
export function isUsableStale(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt)
  const age = now.getTime() - cachedAt.getTime()
  return age < ONE_DAY_MS
}

/**
 * Creates cache metadata for a response.
 */
export function createMetadata(response: Response): CacheMetadata {
  const headers: Record<string, string> = {}
  // Preserve important headers
  const preserveHeaders = [
    "content-type",
    "content-encoding",
    "vary",
    "x-data-source",
  ]
  for (const header of preserveHeaders) {
    const value = response.headers.get(header)
    if (value && !(header === "vary" && value.trim() === "*")) {
      headers[header] = value
    }
  }

  return {
    cachedAt: new Date().toISOString(),
    status: response.status,
    headers,
  }
}
