/**
 * Metadata stored alongside cached responses in KV.
 */
export interface CacheMetadata {
  cachedAt: string; // ISO timestamp
  status: number;
  headers: Record<string, string>;
}

/**
 * A cached response entry with metadata.
 */
export interface CacheEntry {
  body: string;
  metadata: CacheMetadata;
}

// Cache freshness thresholds in milliseconds
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_WEEKS_MS = 14 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

// Clients revalidate daily so a nightly stock sync is not hidden by an old
// browser or intermediary cache. The longer KV lifetime below still protects
// D1 from repeated queries between catalog syncs.
export const CLIENT_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60;
export const CLIENT_CACHE_STALE_WHILE_REVALIDATE_SECONDS = 60 * 60;
export const CLIENT_CACHE_STALE_IF_ERROR_SECONDS = 24 * 60 * 60;

// KV TTL in seconds (1 month)
export const KV_TTL_SECONDS = 30 * 24 * 60 * 60;

export const CACHE_CONTROL_HEADER_VALUE = [
  "public",
  `max-age=${CLIENT_CACHE_MAX_AGE_SECONDS}`,
  `s-maxage=${CLIENT_CACHE_MAX_AGE_SECONDS}`,
  `stale-while-revalidate=${CLIENT_CACHE_STALE_WHILE_REVALIDATE_SECONDS}`,
  `stale-if-error=${CLIENT_CACHE_STALE_IF_ERROR_SECONDS}`,
].join(", ");

/**
 * Checks if a cached entry is fresh (less than 2 weeks old).
 */
export function isFresh(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt);
  const age = now.getTime() - cachedAt.getTime();
  return age < TWO_WEEKS_MS;
}

/**
 * Checks if a cached entry is usable as stale (less than 1 month old).
 */
export function isUsableStale(
  metadata: CacheMetadata,
  now: Date = new Date(),
): boolean {
  const cachedAt = new Date(metadata.cachedAt);
  const age = now.getTime() - cachedAt.getTime();
  return age < ONE_MONTH_MS;
}

/**
 * Creates cache metadata for a response.
 */
export function createMetadata(response: Response): CacheMetadata {
  const headers: Record<string, string> = {};
  // Preserve important headers
  const preserveHeaders = [
    "content-type",
    "content-encoding",
    "vary",
    "x-data-source",
  ];
  for (const header of preserveHeaders) {
    const value = response.headers.get(header);
    if (value && !(header === "vary" && value.trim() === "*")) {
      headers[header] = value;
    }
  }

  return {
    cachedAt: new Date().toISOString(),
    status: response.status,
    headers,
  };
}
