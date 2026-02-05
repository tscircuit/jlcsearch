import {
  type CacheEntry,
  type CacheMetadata,
  KV_TTL_SECONDS,
  createMetadata,
  isFresh,
  isUsableStale,
} from "./cache-entry"
import { generateCacheKey } from "./cache-key"

export type CacheResult =
  | { type: "fresh"; entry: CacheEntry }
  | { type: "stale"; entry: CacheEntry }
  | { type: "miss" }

/**
 * Service for caching responses in KV store.
 */
export class CacheService {
  constructor(private kv: KVNamespace) {}

  /**
   * Gets a cached response, indicating whether it's fresh, stale, or a miss.
   */
  async get(url: URL): Promise<CacheResult> {
    const key = await generateCacheKey(url)
    const result = await this.kv.getWithMetadata<CacheMetadata>(key, "text")

    if (!result.value || !result.metadata) {
      return { type: "miss" }
    }

    const entry: CacheEntry = {
      body: result.value,
      metadata: result.metadata,
    }

    if (isFresh(entry.metadata)) {
      return { type: "fresh", entry }
    }

    if (isUsableStale(entry.metadata)) {
      return { type: "stale", entry }
    }

    return { type: "miss" }
  }

  /**
   * Stores a response in the cache.
   */
  async put(url: URL, response: Response): Promise<CacheEntry> {
    const key = await generateCacheKey(url)
    const body = await response.text()
    const metadata = createMetadata(response)

    await this.kv.put(key, body, {
      expirationTtl: KV_TTL_SECONDS,
      metadata,
    })

    return { body, metadata }
  }

  /**
   * Builds a Response from a cache entry with appropriate headers.
   */
  buildResponse(
    entry: CacheEntry,
    cacheStatus: "HIT" | "MISS" | "STALE",
    origin: string | null,
  ): Response {
    const headers = new Headers(entry.metadata.headers)
    headers.set("x-cache", cacheStatus)
    headers.set("x-cached-at", entry.metadata.cachedAt)
    addCorsHeaders(headers, origin)

    return new Response(entry.body, {
      status: entry.metadata.status,
      headers,
    })
  }
}

const ALLOWED_HEADERS = [
  "x-csrf-token",
  "x-requested-with",
  "accept",
  "accept-version",
  "content-length",
  "content-md5",
  "content-type",
  "date",
  "authorization",
  "user-agent",
]

/**
 * Adds CORS headers matching the Fly server implementation.
 */
export function addCorsHeaders(headers: Headers, origin: string | null): void {
  headers.set("access-control-allow-origin", origin ?? "*")
  headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS")
  headers.set("access-control-allow-credentials", "true")
  headers.set("access-control-allow-headers", ALLOWED_HEADERS.join(", "))
  headers.set("access-control-max-age", "86400")
  headers.set("vary", "Origin")
}
