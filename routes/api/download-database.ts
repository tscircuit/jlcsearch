import { withWinterSpec } from "lib/with-winter-spec"
import { z } from "zod"
import fs from "node:fs"
import Path from "node:path"

export default withWinterSpec({
  auth: "none",
  methods: ["GET"],
  queryParams: z.object({
    token: z.string(),
  }),
  response: z.any(),
} as const)(async (req) => {
  const { token } = req.query
  
  // Validate token against environment variable
  const validToken = process.env.DATABASE_DOWNLOAD_TOKEN
  if (!validToken) {
    return new Response("Database download not configured", { status: 503 })
  }
  
  if (token !== validToken) {
    return new Response("Invalid token", { status: 401 })
  }
  
  // Path to the SQLite database
  const dbPath = Path.join(import.meta.dir, "../../db.sqlite3")
  
  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    return new Response("Database file not found", { status: 404 })
  }
  
  // Read the database file
  const dbBuffer = fs.readFileSync(dbPath)
  
  // Return the database file as a download
  return new Response(dbBuffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename=\"jlcpcb-parts.sqlite3\"",
      "Content-Length": dbBuffer.length.toString(),
    },
  })
})