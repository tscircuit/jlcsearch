import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import Path from "node:path"
import { getBunDatabaseClient, getResolvedDbPath } from "lib/db/get-db-client"

let tempDir: string | undefined

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

test("getBunDatabaseClient opens a configured database path", () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-db-"))
  const dbPath = Path.join(tempDir, "custom.sqlite3")

  const seedDb = new Database(dbPath)
  seedDb.exec(`
    CREATE TABLE probe (value TEXT);
    INSERT INTO probe (value) VALUES ('ok');
  `)
  seedDb.close()

  expect(getResolvedDbPath(dbPath)).toBe(dbPath)

  const db = getBunDatabaseClient(dbPath)
  const row = db.query("SELECT value FROM probe").get() as {
    value: string
  } | null

  expect(row?.value).toBe("ok")
  db.close()
})
