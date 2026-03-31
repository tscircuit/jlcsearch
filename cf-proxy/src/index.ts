import { CacheService, addCorsHeaders } from "./cache-service"
import { queryComponentCatalog } from "./components"
import { getD1Client } from "./db/get-d1-client"
import { getD1Handler } from "./d1-routes"
import { renderD1TablePage, renderHomePage } from "./render"
import { searchIndex } from "./search"

export interface Env {
  CACHE_KV: KVNamespace
  ORIGIN_URL: string
  DB: D1Database
  USE_D1: string
}

const ORIGIN_TIMEOUT_MS = 10_000
const BLOCKED_REQUEST_HEADERS = new Set([
  "cookie",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
  "host",
  "connection",
  "content-length",
])

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

    if (
      env.USE_D1 === "true" &&
      request.method === "GET" &&
      url.pathname === "/"
    ) {
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "x-data-source": "d1",
      })
      addCorsHeaders(headers, origin)
      return new Response(renderHomePage(), { status: 200, headers })
    }

    // Only cache GET requests
    if (request.method !== "GET") {
      return proxyToOrigin(url, request, env, origin)
    }

    const cache = new CacheService(env.CACHE_KV)

    // Check if this is a JSON API request that can be handled by D1
    if (env.USE_D1 === "true") {
      const d1Response = await tryD1Route(url, request, env, origin, ctx, cache)
      if (d1Response) {
        return d1Response
      }
    }

    const cacheResult = await cache.get(url)

    // Fresh cache hit - return immediately
    if (cacheResult.type === "fresh") {
      return cache.buildResponse(cacheResult.entry, "HIT", origin)
    }

    // If stale entry exists, serve it immediately and refresh in background
    const staleEntry = cacheResult.type === "stale" ? cacheResult.entry : null
    if (staleEntry) {
      ctx.waitUntil(refreshStaleEntry(url, request, env, cache))
      return cache.buildResponse(staleEntry, "STALE", origin)
    }

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

async function refreshStaleEntry(
  url: URL,
  request: Request,
  env: Env,
  cache: CacheService,
): Promise<void> {
  try {
    const originResponse = await fetchFromOrigin(url, request, env)
    if (originResponse.ok) {
      await cache.put(url, originResponse)
    }
  } catch (error) {
    console.warn("Background stale refresh failed:", error)
  }
}

/**
 * Attempts to handle the request via D1 if it's a supported JSON API route.
 * Returns null if the request should be handled by the origin.
 */
async function tryD1Route(
  url: URL,
  request: Request,
  env: Env,
  origin: string | null,
  ctx: ExecutionContext,
  cache: CacheService,
): Promise<Response | null> {
  const hasJsonSuffix = url.pathname.endsWith(".json")
  // Check if this is a JSON request
  const isJsonRequest = Boolean(
    hasJsonSuffix ||
      url.searchParams.get("json") === "true" ||
      request.headers.get("accept")?.includes("application/json"),
  )

  const pathname = url.pathname.replace(/\.json$/, "")

  if (pathname === "/api/search") {
    return handleD1Search(url, env, origin)
  }

  if (pathname === "/components/list") {
    return handleD1ComponentsListWithCache(
      url,
      isJsonRequest,
      env,
      origin,
      ctx,
      cache,
    )
  }

  if (!isJsonRequest) {
    const db = getD1Client(env.DB)
    const params = Object.fromEntries(url.searchParams)
    const handler = getD1Handler(pathname)
    if (!handler) {
      return null
    }

    try {
      const result = await handler(db, params)
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "x-data-source": "d1",
        "x-cache": "D1",
      })
      addCorsHeaders(headers, origin)

      return new Response(
        renderD1TablePage(
          pathname,
          result.data,
          params,
          url.toString(),
          result.filterOptions,
        ),
        {
          status: 200,
          headers,
        },
      )
    } catch (error) {
      console.error("D1 query failed:", error)
      return null
    }
  }

  // Get handler for this route
  const handler = getD1Handler(pathname)
  if (!handler) {
    return null
  }

  try {
    const db = getD1Client(env.DB)
    const params = Object.fromEntries(url.searchParams)
    const result = await handler(db, params)

    const headers = new Headers({
      "x-data-source": "d1",
      "x-cache": "D1",
    })
    addCorsHeaders(headers, origin)

    if (isJsonRequest) {
      headers.set("content-type", "application/json")
      return new Response(JSON.stringify(result.data), {
        status: 200,
        headers,
      })
    }

    headers.set("content-type", "text/html; charset=utf-8")
    return new Response(
      renderD1TablePage(
        pathname,
        result.data,
        params,
        url.toString(),
        result.filterOptions,
      ),
      {
        status: 200,
        headers,
      },
    )
  } catch (error) {
    // Log error and fall through to origin proxy
    console.error("D1 query failed:", error)
    return null
  }
}

async function handleD1Search(
  url: URL,
  env: Env,
  origin: string | null,
): Promise<Response | null> {
  try {
    const db = getD1Client(env.DB)
    const params = Object.fromEntries(url.searchParams)
    const rows = await searchIndex(db, params)
    const components = rows.map((row) => ({
      lcsc: row.lcsc ?? 0,
      mfr: row.mfr ?? "",
      package: row.package ?? "",
      description: row.description ?? "",
      stock: row.stock ?? 0,
      price1: row.price1 ?? 0,
      source_table: row.source_table ?? "",
    }))

    const headers = new Headers({
      "content-type": "application/json",
      "x-data-source": "d1",
      "x-cache": "D1",
    })
    addCorsHeaders(headers, origin)

    return new Response(JSON.stringify({ components }), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("D1 search failed:", error)
    return null
  }
}

const getD1RepresentationCacheUrl = (url: URL, isJsonRequest: boolean): URL => {
  const cacheUrl = new URL(url.toString())
  cacheUrl.searchParams.set("__format", isJsonRequest ? "json" : "html")
  return cacheUrl
}

async function refreshStaleD1ComponentsEntry(
  url: URL,
  isJsonRequest: boolean,
  env: Env,
  origin: string | null,
  cache: CacheService,
): Promise<void> {
  try {
    const response = await handleD1ComponentsList(
      url,
      isJsonRequest,
      env,
      origin,
    )
    if (response?.ok) {
      await cache.put(getD1RepresentationCacheUrl(url, isJsonRequest), response)
    }
  } catch (error) {
    console.warn("Background D1 components cache refresh failed:", error)
  }
}

async function handleD1ComponentsListWithCache(
  url: URL,
  isJsonRequest: boolean,
  env: Env,
  origin: string | null,
  ctx: ExecutionContext,
  cache: CacheService,
): Promise<Response | null> {
  const cacheUrl = getD1RepresentationCacheUrl(url, isJsonRequest)
  const cacheResult = await cache.get(cacheUrl)

  if (cacheResult.type === "fresh") {
    return cache.buildResponse(cacheResult.entry, "HIT", origin)
  }

  const staleEntry = cacheResult.type === "stale" ? cacheResult.entry : null
  if (staleEntry) {
    ctx.waitUntil(
      refreshStaleD1ComponentsEntry(url, isJsonRequest, env, origin, cache),
    )
    return cache.buildResponse(staleEntry, "STALE", origin)
  }

  const response = await handleD1ComponentsList(url, isJsonRequest, env, origin)
  if (!response) {
    return null
  }

  if (!response.ok) {
    return response
  }

  const entry = await cache.put(cacheUrl, response)
  return cache.buildResponse(entry, "MISS", origin)
}

async function handleD1ComponentsList(
  url: URL,
  isJsonRequest: boolean,
  env: Env,
  origin: string | null,
): Promise<Response | null> {
  const params = Object.fromEntries(url.searchParams)

  try {
    const db = getD1Client(env.DB)
    const rows = await queryComponentCatalog(db, params)
    const data = {
      components: rows.map((row) => ({
        lcsc: row.lcsc ?? 0,
        mfr: row.mfr ?? "",
        package: row.package ?? "",
        description: row.description ?? "",
        stock: row.stock ?? 0,
        price: row.price ?? "",
        category: row.category ?? "",
        subcategory: row.subcategory ?? "",
        is_basic: Boolean(row.basic),
        is_preferred: Boolean(row.preferred),
      })),
    }

    const headers = new Headers({
      "x-data-source": "d1",
      "x-cache": "D1",
    })
    addCorsHeaders(headers, origin)

    if (isJsonRequest) {
      headers.set("content-type", "application/json")
      return new Response(JSON.stringify(data), {
        status: 200,
        headers,
      })
    }

    headers.set("content-type", "text/html; charset=utf-8")
    return new Response(
      renderD1TablePage("/components/list", data, params, url.toString()),
      {
        status: 200,
        headers,
      },
    )
  } catch (error) {
    console.error("D1 components list failed:", error)
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
  const headers = sanitizeRequestHeaders(request.headers)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ORIGIN_TIMEOUT_MS)

  try {
    const response = await fetch(originUrl.toString(), {
      method: request.method,
      headers,
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
  const headers = sanitizeRequestHeaders(request.headers)

  const response = await fetch(originUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
  })

  // Clone response and add CORS headers
  const responseHeaders = new Headers(response.headers)
  addCorsHeaders(responseHeaders, origin)
  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
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

function sanitizeRequestHeaders(headers: Headers): Headers {
  const sanitized = new Headers()

  for (const [name, value] of headers.entries()) {
    const lowerName = name.toLowerCase()
    if (
      BLOCKED_REQUEST_HEADERS.has(lowerName) ||
      lowerName.startsWith("cf-") ||
      lowerName.startsWith("x-forwarded-")
    ) {
      continue
    }
    sanitized.set(name, value)
  }

  return sanitized
}
