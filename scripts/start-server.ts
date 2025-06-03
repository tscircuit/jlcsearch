import { createWinterSpecBundleFromDir } from "winterspec/adapters/node"
import {} from "winterspec"
import * as Path from "node:path"

console.log(`Loading API routes from "./routes"...`)
const winterspecBundle = await createWinterSpecBundleFromDir(
  Path.join(import.meta.dir, "../routes"),
)

console.log("Starting server on port http://localhost:3065 ...")
Bun.serve({
  fetch: (req) => {
    const response = winterspecBundle.makeRequest(req)
    return response
  },
  routes: {
    [`/database/${process.env.DATABASE_DOWNLOAD_TOKEN}`]: () =>
      new Response(Bun.file("./db.sqlite3")),
  },
  port: 3065,
})
