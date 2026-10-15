import { describe, expect, test } from "bun:test"
import {
  type EasyEdaComponentCacheMetrics,
  fetchEasyEdaComponentFromCache,
} from "../lib/easyeda-component-cache-client"

const createMetrics = (): EasyEdaComponentCacheMetrics => ({
  cacheHits: 0,
  cacheMisses: 0,
  negativeCacheHits: 0,
})

const foundResponse = () =>
  Response.json({
    easyeda_component_details: {
      lcsc: 123,
      easyeda_json: { uuid: "easyeda-uuid" },
    },
  })

describe("fetchEasyEdaComponentFromCache", () => {
  test("returns an R2 hit without using the rate-limited fill fetch", async () => {
    const metrics = createMetrics()
    let fillCalls = 0
    const result = await fetchEasyEdaComponentFromCache("C123", {
      cacheOrigin: "https://jlcsearch.tscircuit.com/",
      cacheProbeFetch: async () => foundResponse(),
      cacheFillFetch: async () => {
        fillCalls += 1
        return foundResponse()
      },
      metrics,
    })

    expect(result).toEqual({ uuid: "easyeda-uuid" })
    expect(fillCalls).toBe(0)
    expect(metrics).toEqual({
      cacheHits: 1,
      cacheMisses: 0,
      negativeCacheHits: 0,
    })
  })

  test("fills the cache after an R2-only miss", async () => {
    const metrics = createMetrics()
    const requestedUrls: string[] = []
    const result = await fetchEasyEdaComponentFromCache("C123", {
      cacheOrigin: "https://jlcsearch.tscircuit.com",
      cacheProbeFetch: async (input) => {
        requestedUrls.push(input.toString())
        return Response.json(
          {
            error: { error_code: "cache_miss", message: "not cached" },
          },
          { status: 404 },
        )
      },
      cacheFillFetch: async (input) => {
        requestedUrls.push(input.toString())
        return foundResponse()
      },
      metrics,
    })

    expect(result).toEqual({ uuid: "easyeda-uuid" })
    expect(requestedUrls).toEqual([
      "https://jlcsearch.tscircuit.com/api/easyeda_components/C123?cache_only=true",
      "https://jlcsearch.tscircuit.com/api/easyeda_components/C123",
    ])
    expect(metrics.cacheMisses).toBe(1)
  })

  test("surfaces negative R2 hits without attempting another fill", async () => {
    const metrics = createMetrics()
    let fillCalls = 0
    const request = fetchEasyEdaComponentFromCache("C404", {
      cacheOrigin: "https://jlcsearch.tscircuit.com",
      cacheProbeFetch: async () =>
        Response.json(
          {
            error: {
              error_code: "component_not_found",
              message: "Component not found",
            },
          },
          { status: 404 },
        ),
      cacheFillFetch: async () => {
        fillCalls += 1
        return foundResponse()
      },
      metrics,
    })

    await expect(request).rejects.toThrow("Component not found")
    expect(fillCalls).toBe(0)
    expect(metrics.negativeCacheHits).toBe(1)
  })

  test("preserves a rate-limit error from the fill endpoint", async () => {
    const metrics = createMetrics()
    const request = fetchEasyEdaComponentFromCache("C123", {
      cacheOrigin: "https://jlcsearch.tscircuit.com",
      cacheProbeFetch: async () =>
        Response.json(
          { error: { error_code: "cache_miss", message: "not cached" } },
          { status: 404 },
        ),
      cacheFillFetch: async () =>
        Response.json(
          {
            error: {
              error_code: "easyeda_fetch_failed",
              message: "EasyEDA API rate limit exceeded (HTTP 403)",
            },
          },
          { status: 403 },
        ),
      metrics,
    })

    await expect(request).rejects.toThrow("rate limit exceeded")
  })
})
