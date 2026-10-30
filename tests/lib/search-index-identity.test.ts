import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { queryComponentCatalog } from "../../cf-proxy/src/components"
import { searchIndex } from "../../cf-proxy/src/search"

const databases: Kysely<DB>[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.destroy()))
})

const createCatalog = () => {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE search_index (
      lcsc INTEGER UNIQUE, mfr TEXT, package TEXT, description TEXT,
      stock INTEGER, price TEXT, price1 REAL, basic INTEGER,
      preferred INTEGER, category TEXT, subcategory TEXT, search_text TEXT
    );
    -- Synthetic sensor ID; the MOSFET identity is the unrelated live result.
    INSERT INTO search_index VALUES
      (9001, 'TTP223-BA6', 'SOT-23-6', 'Touch sensor',
       100, '0.10', 0.10, 1, 0, 'Sensors', 'Touch Sensors',
       'ttp223-ba6 sot-23-6 touch sensor'),
      (42401279, 'HAOT10N65', 'TO-220F', 'MOSFET',
       2, '0.50', 0.50, 0, 1, 'Transistors', 'MOSFETs',
       'haot10n65 to-220f mosfet');
  `)
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
  databases.push(db)
  // The worker and root packages have separate Kysely private type brands.
  const searchDb = db as unknown as Parameters<typeof searchIndex>[0]
  return {
    sqlite,
    db: searchDb,
    search: (params: Parameters<typeof searchIndex>[1]) =>
      searchIndex(searchDb, params),
  }
}

const createFts = async (sqlite: Database) => {
  sqlite.exec(
    await Bun.file(
      new URL("../../cf-proxy/scripts/setup-fts5.sql", import.meta.url),
    ).text(),
  )
  sqlite.exec(`
    INSERT INTO search_index_fts(rowid, lcsc, search_text)
      SELECT rowid, lcsc, search_text FROM search_index;
    UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
  `)
}

const reorderCatalog = (sqlite: Database) => {
  sqlite.exec(`
    CREATE TABLE search_index_next AS
      SELECT * FROM search_index ORDER BY lcsc DESC;
    DROP TABLE search_index;
    ALTER TABLE search_index_next RENAME TO search_index;
  `)
}

test("legacy FTS cannot map a TTP223-BA6 search to a MOSFET after rowids change", async () => {
  const { sqlite, db, search } = createCatalog()
  sqlite.exec(`
    CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
    INSERT INTO search_index_fts(rowid, search_text)
      SELECT rowid, search_text FROM search_index;
    CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO search_index_fts_meta VALUES ('ready', '1');
  `)
  reorderCatalog(sqlite)

  // Run the actual query and /components/list adapter, without mocking fetch.
  expect((await search({ q: "TTP223-BA6" })).map((row) => row.mfr)).toEqual([
    "TTP223-BA6",
  ])
  expect(
    (await queryComponentCatalog(db, { search: "TTP223-BA6" })).map(
      (row) => row.lcsc,
    ),
  ).toEqual([9001])
  expect((await search({ q: "HAOT10N65" })).map((row) => row.lcsc)).toEqual([
    42401279,
  ])
})

test("versioned FTS follows LCSC identity when catalog rowids are reassigned", async () => {
  const { sqlite, search } = createCatalog()
  await createFts(sqlite)
  reorderCatalog(sqlite)

  expect((await search({ q: "TTP223-BA6" })).map((row) => row.lcsc)).toEqual([
    9001,
  ])
  expect((await search({ q: "HAOT10N65" })).map((row) => row.lcsc)).toEqual([
    42401279,
  ])
  expect((await search({ q: "C42401279" })).map((row) => row.mfr)).toEqual([
    "HAOT10N65",
  ])
})

test("FTS text must still match the current catalog before applying the result limit", async () => {
  const { sqlite, search } = createCatalog()
  await createFts(sqlite)
  sqlite.exec(`
    UPDATE search_index SET stock = 1000 WHERE lcsc = 42401279;
    UPDATE search_index_fts SET search_text = 'ttp223-ba6 touch sensor'
      WHERE lcsc = 42401279;
  `)

  expect(
    (await search({ q: "TTP223-BA6", limit: "1" })).map((r) => r.lcsc),
  ).toEqual([9001])
  sqlite.exec("DELETE FROM search_index WHERE lcsc = 9001")
  expect(await search({ q: "TTP223-BA6" })).toEqual([])
})

test("FTS searches preserve stock and component filters", async () => {
  const { sqlite, search } = createCatalog()
  await createFts(sqlite)
  const params = {
    q: "TTP223-BA6",
    package: "SOT-23-6",
    subcategory_name: "Touch Sensors",
    is_basic: "true",
  }
  expect((await search(params)).map((row) => row.lcsc)).toEqual([9001])
  expect(await search({ ...params, package: "TO-220F" })).toEqual([])
  expect(await search({ ...params, is_preferred: "true" })).toEqual([])
  for (const stock of [0, null]) {
    sqlite
      .query("UPDATE search_index SET stock = ? WHERE lcsc = 9001")
      .run(stock)
    expect(await search(params)).toEqual([])
  }
})

test("an unfinished or missing FTS index uses current catalog text", async () => {
  const { sqlite, search } = createCatalog()
  await createFts(sqlite)
  sqlite.exec(`
    DELETE FROM search_index_fts;
    UPDATE search_index_fts_meta SET value = '0' WHERE key = 'ready';
  `)
  expect((await search({ q: "TTP223-BA6" })).map((row) => row.lcsc)).toEqual([
    9001,
  ])
  sqlite.exec(`
    UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
    DROP TABLE search_index_fts;
  `)
  expect((await search({ q: "TTP223-BA6" })).map((row) => row.lcsc)).toEqual([
    9001,
  ])
})

test("an incompatible FTS schema falls back without hiding catalog errors", async () => {
  const { sqlite, search } = createCatalog()
  await createFts(sqlite)
  sqlite.exec(`
    DELETE FROM search_index_fts;
    UPDATE search_index_fts_meta SET value = 'unknown' WHERE key = 'schema';
  `)
  expect((await search({ q: "TTP223-BA6" })).map((row) => row.lcsc)).toEqual([
    9001,
  ])
  sqlite.exec("DROP TABLE search_index")
  expect(search({ q: "TTP223-BA6" })).rejects.toThrow(
    "no such table: search_index",
  )
})

test("SQL catalog rebuild invalidates an index made from the previous rowids", async () => {
  const { sqlite, search } = createCatalog()
  await createFts(sqlite)
  sqlite.exec(`
    CREATE TABLE component_catalog AS
      SELECT lcsc, mfr, package, description, stock, price, basic, preferred,
        category, subcategory, NULL AS extra
      FROM search_index ORDER BY lcsc DESC;
    UPDATE component_catalog SET mfr = 'UPDATED-SENSOR' WHERE lcsc = 9001;
  `)
  sqlite.exec(
    await Bun.file(
      new URL(
        "../../cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
        import.meta.url,
      ),
    ).text(),
  )
  expect(
    sqlite
      .query(
        "SELECT name FROM sqlite_master WHERE name = 'search_index_fts_meta'",
      )
      .get(),
  ).toBeNull()
  // The new catalog text is absent from the old FTS generation.
  expect(
    (await search({ q: "UPDATED-SENSOR" })).map((row) => row.lcsc),
  ).toEqual([9001])
})
