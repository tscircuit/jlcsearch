import defaultAxios from "redaxios"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"
import * as Path from "node:path"
import { createWinterSpecBundleFromDir } from "winterspec/adapters/node"

interface TestFixture {
  url: string
  db: KyselyDatabaseInstance
  server: any
  axios: typeof defaultAxios
  // seed: Awaited<ReturnType<typeof seedFixture>>
  jane_axios: typeof defaultAxios
}

const winterspecBundle = await createWinterSpecBundleFromDir(
  Path.join(import.meta.dir, "../../routes"),
)

export const getTestServer = async (
  options: { env?: Record<string, string> } = {},
): Promise<TestFixture> => {
  const port = 3001 + Math.floor(Math.random() * 999)
  const testInstanceId = Math.random().toString(36).substring(2, 15)

  const fixture = {} as TestFixture

  const server = Bun.serve({
    port,
    fetch: (req) => {
      const response = winterspecBundle.makeRequest(req)
      return response
    },
  })

  const url = `http://127.0.0.1:${port}`
  const axios = defaultAxios.create({
    baseURL: url,
  })

  fixture.axios = axios
  fixture.url = url
  fixture.server = server

  fixture.jane_axios = defaultAxios.create({
    baseURL: url,
    headers: {},
  })

  globalThis.deferredCleanupFns ??= []
  globalThis.deferredCleanupFns.push(async () => {
    await server.stop()
  })

  return fixture
}
