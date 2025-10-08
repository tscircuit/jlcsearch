import { readFile } from "node:fs/promises"
import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import { getOpenAiClient } from "lib/openai"

type OpenAPISpec = {
  paths: Record<
    string,
    {
      get?: {
        parameters?: Array<{
          name: string
          in: string
          required?: boolean
        }>
      }
    }
  >
}

type EndpointSummary = {
  method: "GET"
  queryParams: Map<string, { required: boolean }>
}

let cachedOpenApiSummary: {
  prompt: string
  endpoints: Map<string, EndpointSummary>
} | null = null

const loadOpenApiSummary = async () => {
  if (cachedOpenApiSummary) {
    return cachedOpenApiSummary
  }

  const openapiUrl = new URL("../docs/openapi.json", import.meta.url)
  const spec = JSON.parse(await readFile(openapiUrl, "utf-8")) as OpenAPISpec

  const lines: string[] = []
  const endpoints = new Map<string, EndpointSummary>()

  for (const [path, item] of Object.entries(spec.paths)) {
    if (path === "/search" || path === "/api/search") continue
    if (path.includes("{")) continue
    if (path.includes("[")) continue
    const getOperation = item.get
    if (!getOperation) continue

    const queryParams = new Map<string, { required: boolean }>()
    const params = getOperation.parameters ?? []

    for (const param of params) {
      if (param.in !== "query") continue
      queryParams.set(param.name, {
        required: Boolean(param.required),
      })
    }

    const queryDescription =
      queryParams.size > 0
        ? ` query: ${Array.from(queryParams.entries())
            .map(([name, meta]) => `${name}${meta.required ? "!" : ""}`)
            .join(", ")}`
        : ""

    lines.push(`GET ${path}${queryDescription}`.trim())
    endpoints.set(path, {
      method: "GET",
      queryParams,
    })
  }

  const promptLines = [
    "Available endpoints (GET only):",
    ...lines,
    'Respond with JSON: { "endpoint": string, "params": object }.',
    "Only choose from the endpoints listed above.",
  ]

  cachedOpenApiSummary = {
    prompt: promptLines.join("\n"),
    endpoints,
  }

  return cachedOpenApiSummary
}

const parseJsonObject = (raw: string) => {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) {
      throw error
    }
    const substring = trimmed.slice(start, end + 1)
    return JSON.parse(substring)
  }
}

const ensureParamsObject = (value: unknown) => {
  if (value == null) return {}
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("params must be an object")
  }
  return value as Record<string, unknown>
}

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    q: z.string().min(1),
  }),
  jsonResponse: z.object({
    search_result: z.object({
      components: z.unknown(),
      endpoint_used: z.string(),
      filter_params: z.record(z.unknown()),
    }),
  }),
} as const)(async (req, ctx) => {
  const query = req.query.q?.trim()

  if (!query) {
    return ctx.error(400, {
      error_code: "missing_query",
      message: "Query parameter q is required",
    })
  }

  const { prompt, endpoints } = await loadOpenApiSummary()

  let openaiClient: ReturnType<typeof getOpenAiClient>

  try {
    openaiClient = getOpenAiClient()
  } catch (error) {
    return ctx.error(500, {
      error_code: "missing_openai_api_key",
      message: "OPENAI_API_KEY environment variable is not configured",
    })
  }

  const completion = await openaiClient.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You plan API requests for the jlcsearch service. Return valid JSON only.",
      },
      {
        role: "user",
        content: `${prompt}\n\nUser query: ${query}`,
      },
    ],
  })

  const message = completion.choices[0]?.message
  const messageContent = message?.content
  let content = ""

  if (typeof messageContent === "string") {
    content = messageContent
  } else if (Array.isArray(messageContent)) {
    content = (messageContent as Array<unknown>)
      .map((part: unknown) => {
        if (typeof part === "string") return part
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type: string }).type === "text"
        ) {
          const textPart = part as { text?: string }
          return textPart.text ?? ""
        }
        return ""
      })
      .join("")
  }

  content = content.trim()

  if (!content) {
    return ctx.error(502, {
      error_code: "empty_llm_response",
      message: "OpenAI did not return a response",
    })
  }

  let parsed: { endpoint?: string; params?: Record<string, unknown> }

  try {
    parsed = parseJsonObject(content)
  } catch (error) {
    return ctx.error(502, {
      error_code: "invalid_llm_response",
      message: "Failed to parse OpenAI response",
    })
  }

  const endpointUsed = parsed.endpoint

  if (!endpointUsed) {
    return ctx.error(400, {
      error_code: "missing_endpoint",
      message: "OpenAI response did not include an endpoint",
    })
  }

  const endpointMeta = endpoints.get(endpointUsed)

  if (!endpointMeta) {
    return ctx.error(400, {
      error_code: "invalid_endpoint",
      message: `Endpoint ${endpointUsed} is not allowed`,
    })
  }

  let paramsObject: Record<string, unknown>
  try {
    paramsObject = ensureParamsObject(parsed.params)
  } catch (error) {
    return ctx.error(400, {
      error_code: "invalid_params",
      message: "OpenAI response params must be an object",
    })
  }

  const sanitizedParams: Record<string, string> = {}

  for (const [name, meta] of endpointMeta.queryParams.entries()) {
    const rawValue = paramsObject[name]

    if (rawValue == null) {
      if (meta.required) {
        return ctx.error(400, {
          error_code: "missing_required_param",
          message: `Missing required parameter ${name}`,
        })
      }
      continue
    }

    sanitizedParams[name] = String(rawValue)
  }

  for (const key of Object.keys(paramsObject)) {
    if (!endpointMeta.queryParams.has(key)) {
      return ctx.error(400, {
        error_code: "unexpected_param",
        message: `Parameter ${key} is not supported for ${endpointUsed}`,
      })
    }
  }

  const url = new URL(req.url)
  url.pathname = endpointUsed
  url.search = new URLSearchParams(sanitizedParams).toString()

  let internalResponse: Response

  try {
    internalResponse = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    })
  } catch (error) {
    return ctx.error(502, {
      error_code: "internal_request_failed",
      message: "Failed to call internal endpoint",
    })
  }

  if (!internalResponse.ok) {
    return ctx.error(internalResponse.status, {
      error_code: "internal_request_failed",
      message: `Internal endpoint responded with status ${internalResponse.status}`,
    })
  }

  let data: any

  try {
    data = await internalResponse.json()
  } catch (error) {
    return ctx.error(502, {
      error_code: "invalid_internal_response",
      message: "Internal endpoint did not return JSON",
    })
  }

  return ctx.json({
    search_result: {
      components: data?.components ?? data ?? null,
      endpoint_used: endpointUsed,
      filter_params: sanitizedParams,
    },
  })
})
