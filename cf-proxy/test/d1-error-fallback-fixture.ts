import { generateCacheKey } from "../src/cache-key"
import { createSelf, createTestEnv } from "./test-env"

const OVERLOADED =
  "D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window."

export const RESISTORS_URL = "https://example.com/resistors/list.json"
export const cachedBody = '{"resistors":[{"lcsc":2,"mfr":"Cached part"}]}'
export const liveBody = {
  resistors: [{ lcsc: 1, mfr: "Live part", package: "0402", stock: 5 }],
}

export const createFixture = () => {
  const env = createTestEnv()
  const queries: string[] = []
  const state = {
    failReads: false,
    failWrites: false,
    waitForRead: undefined as Promise<void> | undefined,
  }
  env.USE_D1 = "true"
  env.DB = {
    prepare: (query: string) => ({
      bind: () => ({
        all: async () => {
          queries.push(query)
          await state.waitForRead
          if (state.failReads) throw new Error(OVERLOADED)
          return { results: liveBody.resistors, meta: {} }
        },
        first: async () => null,
        run: async () => {
          if (state.failWrites) throw new Error(OVERLOADED)
          return { success: true, meta: {} }
        },
      }),
    }),
  } as unknown as D1Database
  return { env, queries, state, self: createSelf(env) }
}

export const seedCache = async (
  env: ReturnType<typeof createTestEnv>,
  ageMinutes: number,
) => {
  const url = new URL(RESISTORS_URL)
  url.searchParams.set("__format", "json")
  const key = await generateCacheKey(url)
  await env.CACHE_KV.put(key, cachedBody, {
    metadata: {
      cachedAt: new Date(Date.now() - ageMinutes * 60 * 1000).toISOString(),
      status: 200,
      headers: { "content-type": "application/json", "x-data-source": "d1" },
    },
  })
  return key
}
