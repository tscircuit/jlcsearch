import defaultAxios from "redaxios"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"
import * as Path from "node:path"
import { createWinterSpecBundleFromDir } from "winterspec/adapters/node"
import { getDbClient, getBunDatabaseClient } from "lib/db/get-db-client"
import { existsSync } from "node:fs"

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

// Wait for database to be ready and ensure tables exist
const waitForDatabase = async (maxRetries = 30, delayMs = 100) => {
  const dbPath = Path.join(import.meta.dir, "../../db.sqlite3")
  
  for (let i = 0; i < maxRetries; i++) {
    if (existsSync(dbPath)) {
      try {
        const db = getDbClient()
        // Test database connection
        await db.executeQuery({ sql: "SELECT 1" })
        
        // Check if components table exists (critical for our tests)
        const tableCheck = await db.executeQuery({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='components'"
        })
        
        if (tableCheck.rows && tableCheck.rows.length > 0) {
          return db
        }
        
        // Table doesn't exist, database not ready yet
        await db.destroy()
      } catch (e) {
        // Database not ready yet, wait and retry
      }
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
  
  throw new Error(`Database not ready after ${maxRetries * delayMs}ms. Path: ${dbPath}. Make sure CI has run database initialization.`)
}

export const getTestServer = async (
  options: { env?: Record<string, string> } = {},
): Promise<TestFixture> => {
  const port = 3001 + Math.floor(Math.random() * 999)
  const testInstanceId = Math.random().toString(36).substring(2, 15)

  const fixture = {} as TestFixture

  // Wait for database to be ready before starting server
  const db = await waitForDatabase()
  fixture.db = db

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
    await db.destroy()
  })

  return fixture
}
