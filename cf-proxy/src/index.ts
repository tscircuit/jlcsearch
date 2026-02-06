import { CacheService, addCorsHeaders } from "./cache-service"
import { getD1Client } from "./db/get-d1-client"
import { getD1Handler } from "./d1-routes"

export interface Env {
  CACHE_KV: KVNamespace
  ORIGIN_URL: string
  DB: D1Database
  USE_D1: string
}

const ORIGIN_TIMEOUT_MS = 10_000

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get("origin")

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(origin)
    }

    // Health check endpoint for D1
    if (url.pathname === "/_d1/health") {
      return handleD1Health(env, origin)
    }

    // Only cache GET requests
    if (request.method !== "GET") {
      return proxyToOrigin(url, request, env, origin)
    }

    // Check if this is a JSON API request that can be handled by D1
    if (env.USE_D1 === "true") {
      const d1Response = await tryD1Query(url, request, env, origin)
      if (d1Response) {
        return d1Response
      }
    }

    const cache = new CacheService(env.CACHE_KV)
    const cacheResult = await cache.get(url)

    // Fresh cache hit - return immediately
    if (cacheResult.type === "fresh") {
      return cache.buildResponse(cacheResult.entry, "HIT", origin)
    }

    // Stale or miss - try to fetch from origin
    const staleEntry = cacheResult.type === "stale" ? cacheResult.entry : null

    try {
      const originResponse = await fetchFromOrigin(url, request, env)

      // Only cache successful responses
      if (originResponse.ok) {
        const entry = await cache.put(url, originResponse)
        return cache.buildResponse(entry, "MISS", origin)
      }

      // Origin returned an error - use stale cache if available
      if (staleEntry) {
        return cache.buildResponse(staleEntry, "STALE", origin)
      }

      // Return the error response with cache header
      const headers = new Headers(originResponse.headers)
      headers.set("x-cache", "ERROR")
      addCorsHeaders(headers, origin)
      return new Response(originResponse.body, {
        status: originResponse.status,
        headers,
      })
    } catch (error) {
      // Network error or timeout - use stale cache if available
      if (staleEntry) {
        return cache.buildResponse(staleEntry, "STALE", origin)
      }

      // No stale cache available - return 502
      const errorHeaders = new Headers({
        "content-type": "application/json",
        "x-cache": "ERROR",
      })
      addCorsHeaders(errorHeaders, origin)
      return new Response(
        JSON.stringify({
          error: "Bad Gateway",
          message: "Origin server unavailable and no cached response available",
        }),
        {
          status: 502,
          headers: errorHeaders,
        },
      )
    }
  },
}

/**
 * Attempts to handle the request via D1 if it's a supported JSON API route.
 * Returns null if the request should be handled by the origin.
 */
async function tryD1Query(
  url: URL,
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response | null> {
  // Check if this is a JSON request
  const isJsonRequest =
    url.searchParams.get("json") === "true" ||
    request.headers.get("accept")?.includes("application/json")

  if (!isJsonRequest) {
    return null
  }

  // Get handler for this route
  const handler = getD1Handler(url.pathname)
  if (!handler) {
    return null
  }

  try {
    const db = getD1Client(env.DB)
    const params = Object.fromEntries(url.searchParams)
    const result = await handler(db, params)

    const headers = new Headers({
      "content-type": "application/json",
      "x-data-source": "d1",
      "x-cache": "D1",
    })
    addCorsHeaders(headers, origin)

    return new Response(JSON.stringify(result.data), {
      status: 200,
      headers,
    })
  } catch (error) {
    // Log error and fall through to origin proxy
    console.error("D1 query failed:", error)
    return null
  }
}

/**
 * Handles the D1 health check endpoint.
 */
async function handleD1Health(
  env: Env,
  origin: string | null,
): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json",
  })
  addCorsHeaders(headers, origin)

  try {
    const db = getD1Client(env.DB)
    const result = await db
      .selectFrom("resistor")
      .select("lcsc")
      .limit(1)
      .execute()

    return new Response(
      JSON.stringify({
        ok: true,
        d1: true,
        use_d1: env.USE_D1,
        rows: result.length,
      }),
      { status: 200, headers },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        d1: false,
        use_d1: env.USE_D1,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers },
    )
  }
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
  origin: string | null,
): Promise<Response> {
  const originUrl = new URL(url.pathname + url.search, env.ORIGIN_URL)

  const response = await fetch(originUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })

  // Clone response and add CORS headers
  const headers = new Headers(response.headers)
  addCorsHeaders(headers, origin)
  return new Response(response.body, {
    status: response.status,
    headers,
  })
}

/**
 * Handles CORS preflight OPTIONS requests.
 */
function handleOptions(origin: string | null): Response {
  const headers = new Headers()
  addCorsHeaders(headers, origin)
  return new Response(null, { status: 204, headers })
}
