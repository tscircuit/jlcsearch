import { afterEach } from "bun:test"
import defaultAxios from "redaxios"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"
import * as Path from "node:path"
import { createFetchHandlerFromDir } from "winterspec/adapters/node"
import { withIsApiRequest } from "../../lib/middlewares/with-is-api-request"

interface TestFixture {
  url: string
  db: KyselyDatabaseInstance
  server: any
  axios: typeof defaultAxios
  // seed: Awaited<ReturnType<typeof seedFixture>>
  jane_axios: typeof defaultAxios
}

export const getTestServer = async (
  options: { env?: Record<string, string> } = {},
): Promise<TestFixture> => {
  const port = 3001 + Math.floor(Math.random() * 999)
  const testInstanceId = Math.random().toString(36).substring(2, 15)

  const fixture = {} as TestFixture

  // Create fetch handler with middleware
  const fetchHandler = await createFetchHandlerFromDir(Path.join(process.cwd(), "routes"), {
    middleware: [withIsApiRequest]
  })

  const server = Bun.serve({
    port,
    fetch: async (req) => {
      // Ensure we have a proper URL with origin that matches winterspec's expectations
      const url = new URL(req.url, `http://localhost:${port}`)
      const fullUrl = url.href // Use href to get the full URL string with origin
      
      // Create request init with all properties
      const init = {
        method: req.method,
        headers: new Headers(req.headers),
        body: req.body,
        duplex: 'half'
      }
      
      // Pass the full URL and init to the fetch handler
      return fetchHandler(fullUrl, init)
    }
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

  afterEach(async () => {
    await server.stop()
  })

  return fixture
}
