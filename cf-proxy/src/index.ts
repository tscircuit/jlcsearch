import { CacheService, addCorsHeaders, addVaryHeader } from "./cache-service"
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

const extractSmallQuantityPrice = (price: string | null): string | number => {
  if (!price) return ""
  try {
    const priceObj = JSON.parse(price)
    return priceObj[0]?.price || ""
  } catch {
    return ""
  }
}

const buildD1ErrorResponse = (
  origin: string | null,
  message: string,
  contentType:
    | "application/json"
    | "text/html; charset=utf-8" = "application/json",
): Response => {
  const headers = new Headers({
    "content-type": contentType,
    "x-data-source": "d1",
    "x-cache": "D1-ERROR",
  })
  addCorsHeaders(headers, origin)

  const body =
    contentType === "application/json"
      ? JSON.stringify({ error: "D1 query failed", message })
      : `<h1>D1 query failed</h1><p>${message}</p>`

  return new Response(body, {
    status: 500,
    headers,
  })
}

const buildD1NotFoundResponse = (
  origin: string | null,
  contentType:
    | "application/json"
    | "text/html; charset=utf-8" = "application/json",
): Response => {
  const headers = new Headers({
    "content-type": contentType,
    "x-data-source": "d1",
    "x-cache": "D1",
  })
  addCorsHeaders(headers, origin)

  const body =
    contentType === "application/json"
      ? JSON.stringify({
          ok: false,
          error: {
            error_code: "not_found",
            message: "Not Found",
          },
        })
      : "<h1>404 - Not Found</h1><p>The requested page could not be found.</p>"

  return new Response(body, {
    status: 404,
    headers,
  })
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

async function refreshStaleD1Entry(
  cacheUrl: URL,
  producer: () => Promise<Response>,
  cache: CacheService,
): Promise<void> {
  try {
    const response = await producer()
    if (response.ok) {
      await cache.put(cacheUrl, response)
    }
  } catch (error) {
    console.warn("Background D1 cache refresh failed:", error)
  }
}

async function handleCachedD1Response(
  cacheUrl: URL,
  origin: string | null,
  ctx: ExecutionContext,
  cache: CacheService,
  producer: () => Promise<Response>,
): Promise<Response> {
  const cacheResult = await cache.get(cacheUrl)

  if (cacheResult.type === "fresh") {
    return cache.buildResponse(cacheResult.entry, "HIT", origin)
  }

  const staleEntry = cacheResult.type === "stale" ? cacheResult.entry : null
  if (staleEntry) {
    ctx.waitUntil(refreshStaleD1Entry(cacheUrl, producer, cache))
    return cache.buildResponse(staleEntry, "STALE", origin)
  }

  const response = await producer()
  if (!response.ok) {
    return response
  }

  const entry = await cache.put(cacheUrl, response)
  return cache.buildResponse(entry, "MISS", origin)
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
  if (url.pathname === "/") {
    return handleCachedD1Response(url, origin, ctx, cache, async () =>
      handleD1HomePage(origin),
    )
  }

  const hasJsonSuffix = url.pathname.endsWith(".json")
  // Check if this is a JSON request
  const isJsonRequest = Boolean(
    hasJsonSuffix ||
      url.searchParams.get("json") === "true" ||
      request.headers.get("accept")?.includes("application/json"),
  )

  const pathname = url.pathname.replace(/\.json$/, "")

  if (pathname === "/api/search") {
    return handleCachedD1Response(url, origin, ctx, cache, async () =>
      handleD1Search(url, env, origin),
    )
  }

  if (pathname === "/components/list") {
    return handleCachedD1Response(
      getD1RepresentationCacheUrl(url, isJsonRequest),
      origin,
      ctx,
      cache,
      async () => handleD1ComponentsList(url, isJsonRequest, env, origin),
    )
  }

  const handler = getD1Handler(pathname)
  if (!handler) {
    if (pathname.endsWith("/list")) {
      return buildD1NotFoundResponse(
        origin,
        isJsonRequest ? "application/json" : "text/html; charset=utf-8",
      )
    }
    return null
  }

  return handleCachedD1Response(
    getD1RepresentationCacheUrl(url, isJsonRequest),
    origin,
    ctx,
    cache,
    async () => handleD1TableRoute(pathname, url, isJsonRequest, env, origin),
  )
}

async function handleD1Search(
  url: URL,
  env: Env,
  origin: string | null,
): Promise<Response> {
  try {
    const db = getD1Client(env.DB)
    const params = Object.fromEntries(url.searchParams)
    const rows = await searchIndex(db, params)
    const components = rows.map((row) => ({
      lcsc: row.lcsc ?? 0,
      mfr: row.mfr ?? "",
      package: row.package ?? "",
      is_basic: Boolean(row.basic),
      is_preferred: Boolean(row.preferred),
      description: row.description ?? "",
      stock: row.stock ?? 0,
      price: row.price1 ?? extractSmallQuantityPrice(row.price),
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
    return buildD1ErrorResponse(
      origin,
      error instanceof Error ? error.message : "Unknown D1 search error",
    )
  }
}

const getD1RepresentationCacheUrl = (url: URL, isJsonRequest: boolean): URL => {
  const cacheUrl = new URL(url.toString())
  cacheUrl.searchParams.set("__format", isJsonRequest ? "json" : "html")
  return cacheUrl
}

function handleD1HomePage(origin: string | null): Response {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "x-data-source": "d1",
    "x-cache": "D1",
  })
  addCorsHeaders(headers, origin)

  return new Response(renderHomePage(), { status: 200, headers })
}

async function handleD1TableRoute(
  pathname: string,
  url: URL,
  isJsonRequest: boolean,
  env: Env,
  origin: string | null,
): Promise<Response> {
  try {
    const db = getD1Client(env.DB)
    const params = Object.fromEntries(url.searchParams)
    const handler = getD1Handler(pathname)
    if (!handler) {
      return buildD1NotFoundResponse(
        origin,
        isJsonRequest ? "application/json" : "text/html; charset=utf-8",
      )
    }

    const result = await handler(db, params)

    const headers = new Headers({
      "x-data-source": "d1",
      "x-cache": "D1",
    })
    addVaryHeader(headers, "Accept")
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
    console.error(`D1 route failed for ${pathname}:`, error)
    return buildD1ErrorResponse(
      origin,
      error instanceof Error ? error.message : "Unknown D1 route error",
      isJsonRequest ? "application/json" : "text/html; charset=utf-8",
    )
  }
}

async function handleD1ComponentsList(
  url: URL,
  isJsonRequest: boolean,
  env: Env,
  origin: string | null,
): Promise<Response> {
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
    addVaryHeader(headers, "Accept")
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
    return buildD1ErrorResponse(
      origin,
      error instanceof Error ? error.message : "Unknown D1 components error",
      isJsonRequest ? "application/json" : "text/html; charset=utf-8",
    )
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
