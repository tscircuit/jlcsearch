import { afterEach } from "bun:test"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { existsSync } from "node:fs"
import * as Path from "node:path"
import Database from "bun:sqlite"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []

// Check if database exists and has required tables
const dbPath = Path.join(import.meta.dir, "../db.sqlite3")
const requiredTables = ["components", "manufacturers", "packages"]

let dbIsValid = false

if (existsSync(dbPath)) {
  try {
    const db = new Database(dbPath, { readonly: true })
    const result = db.query(`
      SELECT COUNT(*) as count FROM sqlite_master 
      WHERE type='table' AND name IN (${requiredTables.map(() => '?').join(',')})
    `).get(...requiredTables) as { count: number }
    
    dbIsValid = result.count === requiredTables.length
    db.close()
  } catch (e) {
    console.error("Database validation failed:", e)
    dbIsValid = false
  }
}

// If database is missing or invalid, run full setup
if (!dbIsValid) {
  console.log("Database missing or invalid, running full setup...")
  const { execSync } = await import("node:child_process")
  try {
    execSync("bun run setup", { stdio: "inherit", cwd: Path.join(import.meta.dir, "..") })
  } catch (e) {
    console.error("Setup failed:", e)
    throw new Error("Failed to initialize database. Make sure to run 'bun run setup' first.")
  }
}

// Setup derived tables
globalThis.derivedTablesSetupPromise ??= setupDerivedTables({ populate: false })

await globalThis.derivedTablesSetupPromise

afterEach(async () => {
  const cleanupFns = [...globalThis.deferredCleanupFns]
  globalThis.deferredCleanupFns.length = 0

  for (let index = cleanupFns.length - 1; index >= 0; index -= 1) {
    const cleanup = cleanupFns[index]
    await cleanup()
  }
})

export {}
