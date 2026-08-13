export interface EasyEdaComponentCacheMetrics {
  cacheHits: number
  cacheMisses: number
  negativeCacheHits: number
}

type FetchFunction = (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => Promise<Response>

interface CacheResponseBody {
  easyeda_component_details?: {
    easyeda_json?: unknown
  }
  error?: {
    error_code?: string
    message?: string
  }
}

interface FetchEasyEdaComponentFromCacheOptions {
  cacheFillFetch: FetchFunction
  cacheOrigin: string
  cacheProbeFetch: FetchFunction
  metrics: EasyEdaComponentCacheMetrics
}

const readResponseBody = async (
  response: Response,
): Promise<CacheResponseBody> =>
  response.json().catch(() => ({})) as Promise<CacheResponseBody>

const getResponseError = (response: Response, body: CacheResponseBody): Error =>
  new Error(
    body.error?.message ??
      `EasyEDA component cache returned HTTP ${response.status}`,
  )

const getEasyEdaJson = (
  response: Response,
  body: CacheResponseBody,
): unknown => {
  if (
    response.ok &&
    body.easyeda_component_details &&
    "easyeda_json" in body.easyeda_component_details &&
    body.easyeda_component_details.easyeda_json !== null
  ) {
    return body.easyeda_component_details.easyeda_json
  }
  throw getResponseError(response, body)
}

export async function fetchEasyEdaComponentFromCache(
  lcsc: string,
  options: FetchEasyEdaComponentFromCacheOptions,
): Promise<unknown> {
  const origin = options.cacheOrigin.replace(/\/$/, "")
  const componentUrl = `${origin}/api/easyeda_components/${lcsc}`
  const probeResponse = await options.cacheProbeFetch(
    `${componentUrl}?cache_only=true`,
    { headers: { accept: "application/json" } },
  )
  const probeBody = await readResponseBody(probeResponse)

  if (probeResponse.ok) {
    options.metrics.cacheHits += 1
    return getEasyEdaJson(probeResponse, probeBody)
  }
  if (probeBody.error?.error_code === "component_not_found") {
    options.metrics.negativeCacheHits += 1
    throw getResponseError(probeResponse, probeBody)
  }
  if (probeBody.error?.error_code !== "cache_miss") {
    throw getResponseError(probeResponse, probeBody)
  }

  options.metrics.cacheMisses += 1
  const fillResponse = await options.cacheFillFetch(componentUrl, {
    headers: { accept: "application/json" },
  })
  const fillBody = await readResponseBody(fillResponse)
  return getEasyEdaJson(fillResponse, fillBody)
}
