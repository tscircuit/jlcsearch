import { beforeEach, expect, test } from "bun:test"
import { getTestServer } from "tests/fixtures/get-test-server"

const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
}

let openAiRequests: Array<{ url: string; body: any }>

beforeEach(() => {
  openAiRequests = []

  const port = 4100 + Math.floor(Math.random() * 2000)
  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === "/v1/chat/completions") {
        const body = await req.json()
        openAiRequests.push({ url: url.pathname, body })

        return Response.json({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: Date.now() / 1000,
          model: body.model ?? "gpt-4o-mini",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({
                  endpoint: "/leds/list",
                  params: { json: true },
                }),
              },
            },
          ],
        })
      }

      return new Response("not found", { status: 404 })
    },
  })

  const previousKey = process.env.OPENAI_API_KEY
  const previousBaseUrl = process.env.OPENAI_BASE_URL

  process.env.OPENAI_API_KEY = "test-openai-key"
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}/v1`

  globalThis.deferredCleanupFns ??= []
  globalThis.deferredCleanupFns.push(async () => {
    if (previousKey === undefined && originalEnv.OPENAI_API_KEY === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY =
        previousKey ?? originalEnv.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY
    }

    if (
      previousBaseUrl === undefined &&
      originalEnv.OPENAI_BASE_URL === undefined
    ) {
      delete process.env.OPENAI_BASE_URL
    } else {
      process.env.OPENAI_BASE_URL =
        previousBaseUrl ??
        originalEnv.OPENAI_BASE_URL ??
        process.env.OPENAI_BASE_URL
    }

    await server.stop()
  })
})

test("GET /search delegates to internal endpoints returned by OpenAI", async () => {
  const { axios } = await getTestServer()

  const response = await axios.get("/search?q=leds")

  expect(response.status).toBe(200)
  expect(response.data.search_result.endpoint_used).toBe("/leds/list")
  expect(response.data.search_result.filter_params).toEqual({ json: "true" })
  expect(openAiRequests.length).toBe(1)

  const [{ body }] = openAiRequests

  expect(body.messages?.[1]?.content).toContain("GET /leds/list")
  expect(body.messages?.[1]?.content).toContain("User query: leds")
})

test("GET /search returns error when OPENAI_API_KEY is missing", async () => {
  delete process.env.OPENAI_API_KEY

  const { axios } = await getTestServer()

  let response: { status: number; data: any } | undefined

  try {
    response = await axios.get("/search?q=test")
  } catch (error) {
    response = error as { status: number; data: any }
  }

  expect(response?.status).toBe(500)
  expect(response?.data).toEqual({
    error: {
      error_code: "missing_openai_api_key",
      message: "OPENAI_API_KEY environment variable is not configured",
    },
  })

  expect(openAiRequests.length).toBe(0)
})
