import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { sql } from "kysely"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import Path from "node:path"
import {
  destroyDbClient,
  getBunDatabaseClient,
  getDbClient,
  getResolvedDbPath,
} from "lib/db/get-db-client"

let tempDir: string | undefined
let previousDbPath = process.env.JLCSEARCH_DB_PATH

afterEach(async () => {
  await destroyDbClient()

  if (previousDbPath === undefined) {
    delete process.env.JLCSEARCH_DB_PATH
  } else {
    process.env.JLCSEARCH_DB_PATH = previousDbPath
  }

  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  }
})

test("getBunDatabaseClient respects JLCSEARCH_DB_PATH", () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-db-"))
  const dbPath = Path.join(tempDir, "custom.sqlite3")

  const seedDb = new Database(dbPath)
  seedDb.exec(`
    CREATE TABLE probe (value TEXT);
    INSERT INTO probe (value) VALUES ('ok');
  `)
  seedDb.close()

  previousDbPath = process.env.JLCSEARCH_DB_PATH
  process.env.JLCSEARCH_DB_PATH = dbPath

  expect(getResolvedDbPath()).toBe(dbPath)

  const db = getBunDatabaseClient()
  const row = db.query("SELECT value FROM probe").get() as {
    value: string
  } | null

  expect(row?.value).toBe("ok")
  db.close()
})

test("destroyDbClient resets the shared kysely client", async () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-db-"))
  const dbPath = Path.join(tempDir, "custom.sqlite3")

  previousDbPath = process.env.JLCSEARCH_DB_PATH
  process.env.JLCSEARCH_DB_PATH = dbPath

  const firstDb = getDbClient()
  await sql`CREATE TABLE probe (value TEXT)`.execute(firstDb)
  await sql`INSERT INTO probe (value) VALUES ('ok')`.execute(firstDb)
  await destroyDbClient()

  const secondDb = getDbClient()
  expect(secondDb).not.toBe(firstDb)

  const result = await sql<{ value: string }>`SELECT value FROM probe`.execute(
    secondDb,
  )
  expect(result.rows[0]?.value).toBe("ok")
})
