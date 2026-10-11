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

// Inventory changes hourly; cache freshness must not hide live corrections.
const FRESH_MS = 15 * 60 * 1000
const USABLE_STALE_MS = 60 * 60 * 1000
export const CLIENT_CACHE_MAX_AGE_SECONDS = 5 * 60
export const CLIENT_CACHE_STALE_WHILE_REVALIDATE_SECONDS = 60
export const CLIENT_CACHE_STALE_IF_ERROR_SECONDS = 5 * 60
export const KV_TTL_SECONDS = 60 * 60

export const CACHE_CONTROL_HEADER_VALUE = [
  "public",
  `max-age=${CLIENT_CACHE_MAX_AGE_SECONDS}`,
  `s-maxage=${CLIENT_CACHE_MAX_AGE_SECONDS}`,
  `stale-while-revalidate=${CLIENT_CACHE_STALE_WHILE_REVALIDATE_SECONDS}`,
  `stale-if-error=${CLIENT_CACHE_STALE_IF_ERROR_SECONDS}`,
].join(", ")

/**
 * Checks if a cached entry is fresh (less than 15 minutes old).
 */
export function isFresh(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt)
  const age = now.getTime() - cachedAt.getTime()
  return age >= 0 && age < FRESH_MS
}

/**
 * Checks if a cached entry is usable as stale (less than 1 hour old).
 */
export function isUsableStale(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt)
  const age = now.getTime() - cachedAt.getTime()
  return age >= 0 && age < USABLE_STALE_MS
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
