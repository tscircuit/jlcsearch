import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
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
    process.env.JLCSEARCH_DB_PATH = undefined
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

test("destroyDbClient allows recreating the singleton after destroy", async () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-db-"))
  const dbPath = Path.join(tempDir, "singleton.sqlite3")

  const seedDb = new Database(dbPath)
  seedDb.exec(`
    CREATE TABLE probe (value TEXT);
    INSERT INTO probe (value) VALUES ('ok');
  `)
  seedDb.close()

  previousDbPath = process.env.JLCSEARCH_DB_PATH
  process.env.JLCSEARCH_DB_PATH = dbPath

  const firstDb = getDbClient()
  await destroyDbClient()
  const secondDb = getDbClient()

  expect(secondDb).not.toBe(firstDb)
  const row = await secondDb
    .selectFrom("probe" as never)
    .select("value" as never)
    .executeTakeFirst()

  expect(row).toEqual({ value: "ok" })
})
