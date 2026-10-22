import { Database } from "bun:sqlite"
import { afterEach, beforeEach, expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { searchIndex } from "../../cf-proxy/src/search"

let sqlite: Database
// Root and worker packages install separate Kysely versions with private brands.
let db: Kysely<DB>

beforeEach(() => {
  sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE search_index (
      lcsc INTEGER, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
      price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
      subcategory TEXT, search_text TEXT
    );
    CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
    CREATE TABLE search_index_fts_meta (key TEXT PRIMARY KEY, value TEXT);
    INSERT INTO search_index_fts_meta VALUES ('ready', '1');
    INSERT INTO search_index (rowid, lcsc, mfr, stock, search_text) VALUES
      (1, 5180184, 'A2006HU-2x4P', 1000, 'a2006hu-2x4p connector housing'),
      (2, 2839431, 'MAX30102', 100, 'max30102 optical sensor'),
      (3, 123, 'OTHER', 500, 'other optical sensor');
    INSERT INTO search_index_fts (rowid, search_text) VALUES
      (1, 'max30102 optical sensor'),
      (2, 'max30102 optical sensor'),
      (3, 'max30102 optical sensor');
  `)
  db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
})

afterEach(async () => {
  await db.destroy()
})

test("FTS matches must also match the current catalog row", async () => {
  const rows = await searchIndex(
    db as unknown as Parameters<typeof searchIndex>[0],
    { q: "MAX30102" },
  )
  expect(rows.map((row) => row.lcsc)).toEqual([2839431])
})

test("stale FTS matches cannot consume the result limit", async () => {
  const rows = await searchIndex(
    db as unknown as Parameters<typeof searchIndex>[0],
    { q: "MAX30102", limit: "1" },
  )
  expect(rows.map((row) => row.lcsc)).toEqual([2839431])
})

test("all query tokens must match the current catalog row", async () => {
  sqlite.exec(
    "UPDATE search_index SET search_text = 'max30102 unrelated' WHERE lcsc = 123",
  )
  const rows = await searchIndex(
    db as unknown as Parameters<typeof searchIndex>[0],
    { q: "MAX30102 optical" },
  )
  expect(rows.map((row) => row.lcsc)).toEqual([2839431])
})

test("search returns no results when only stale FTS matches remain", async () => {
  sqlite.exec("DELETE FROM search_index WHERE lcsc = 2839431")
  expect(
    await searchIndex(db as unknown as Parameters<typeof searchIndex>[0], {
      q: "MAX30102",
    }),
  ).toEqual([])
})
