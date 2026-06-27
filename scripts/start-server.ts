import { createWinterSpecBundleFromDir } from "winterspec/adapters/node"
import {} from "winterspec"
import * as Path from "node:path"

const hostname = process.env.HOST ?? "0.0.0.0"
const port = Number.parseInt(process.env.PORT ?? "3065", 10)

console.log(`Loading API routes from "./routes"...`)
const winterspecBundle = await createWinterSpecBundleFromDir(
  Path.join(import.meta.dir, "../routes"),
)

console.log(`Starting server on http://${hostname}:${port} ...`)
Bun.serve({
  fetch: (req) => {
    const response = winterspecBundle.makeRequest(req)
    return response
  },
  routes: {
    [`/database/${process.env.DATABASE_DOWNLOAD_TOKEN}`]: () =>
      new Response(Bun.file("./db.sqlite3")),
  },
  hostname,
  port,
})
