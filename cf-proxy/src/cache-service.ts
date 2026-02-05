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
  ): Response {
    const headers = new Headers(entry.metadata.headers)
    headers.set("x-cache", cacheStatus)
    headers.set("x-cached-at", entry.metadata.cachedAt)

    return new Response(entry.body, {
      status: entry.metadata.status,
      headers,
    })
  }
}
