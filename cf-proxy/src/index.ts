import { CacheService } from "./cache-service"

export interface Env {
  CACHE_KV: KVNamespace
  ORIGIN_URL: string
}

const ORIGIN_TIMEOUT_MS = 10_000

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url)

    // Only cache GET requests
    if (request.method !== "GET") {
      return proxyToOrigin(url, request, env)
    }

    const cache = new CacheService(env.CACHE_KV)
    const cacheResult = await cache.get(url)

    // Fresh cache hit - return immediately
    if (cacheResult.type === "fresh") {
      return cache.buildResponse(cacheResult.entry, "HIT")
    }

    // Stale or miss - try to fetch from origin
    const staleEntry = cacheResult.type === "stale" ? cacheResult.entry : null

    try {
      const originResponse = await fetchFromOrigin(url, request, env)

      // Only cache successful responses
      if (originResponse.ok) {
        const entry = await cache.put(url, originResponse)
        return cache.buildResponse(entry, "MISS")
      }

      // Origin returned an error - use stale cache if available
      if (staleEntry) {
        return cache.buildResponse(staleEntry, "STALE")
      }

      // Return the error response with cache header
      const headers = new Headers(originResponse.headers)
      headers.set("x-cache", "ERROR")
      return new Response(originResponse.body, {
        status: originResponse.status,
        headers,
      })
    } catch (error) {
      // Network error or timeout - use stale cache if available
      if (staleEntry) {
        return cache.buildResponse(staleEntry, "STALE")
      }

      // No stale cache available - return 502
      return new Response(
        JSON.stringify({
          error: "Bad Gateway",
          message: "Origin server unavailable and no cached response available",
        }),
        {
          status: 502,
          headers: {
            "content-type": "application/json",
            "x-cache": "ERROR",
          },
        },
      )
    }
  },
}

/**
 * Fetches from the origin server with timeout.
 */
async function fetchFromOrigin(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  const originUrl = new URL(url.pathname + url.search, env.ORIGIN_URL)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS)

  try {
    const response = await fetch(originUrl.toString(), {
      method: request.method,
      headers: request.headers,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Proxies non-GET requests directly to origin without caching.
 */
async function proxyToOrigin(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  const originUrl = new URL(url.pathname + url.search, env.ORIGIN_URL)

  return fetch(originUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
}
