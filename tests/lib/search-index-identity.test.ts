import { Database } from "bun:sqlite"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { searchIndex, type SearchQueryParams } from "../../cf-proxy/src/search"

const ftsSchema = readFileSync(
  new URL("../../cf-proxy/scripts/setup-fts5.sql", import.meta.url),
  "utf8",
)

describe("search index identity", () => {
  let sqlite: Database
  let db: Kysely<DB>
  let queries: string[]

  beforeEach(() => {
    sqlite = new Database(":memory:")
    queries = []
    sqlite.exec(`
      CREATE TABLE search_index (
        lcsc INTEGER NOT NULL UNIQUE, mfr TEXT, package TEXT, description TEXT,
        stock INTEGER, price TEXT, price1 REAL, basic INTEGER, preferred INTEGER,
        category TEXT, subcategory TEXT, search_text TEXT
      );
      INSERT INTO search_index VALUES
        (5334505, 'DA14531-00000FX2', 'QFN-24', 'BLE MCU',
         100, '0.10', 0.10, 1, 1, 'ICs', 'Microcontrollers', 'da14531 ble mcu'),
        (2053058, 'ATSAML10E16A-MUT', 'QFN-32', 'Touch MCU',
         80, '0.20', 0.20, 0, 1, 'ICs', 'Microcontrollers', 'atsaml10e16a touch mcu'),
        (3647561, 'BK13C06-50DS/2-0.35V(800)', 'SMD', 'Connector',
         300, '0.30', 0.30, 0, 0, 'Connectors', 'Connectors', 'bk13c06 connector'),
        (659269, 'ADP5070AREZ-R7', 'HTSSOP-20', 'Power converter',
         200, '0.40', 0.40, 0, 0, 'ICs', 'Converters', 'adp5070 power converter');
    `)
    db = new Kysely<DB>({
      dialect: new BunSqliteDialect({ database: sqlite }),
      log: (event) => {
        if (event.level === "query") queries.push(event.query.sql)
      },
    })
  })

  afterEach(async () => {
    await db.destroy()
  })

  const search = (q: string, filters: Omit<SearchQueryParams, "q"> = {}) =>
    // Root and worker dependencies have separate Kysely private type brands.
    searchIndex(db as unknown as Parameters<typeof searchIndex>[0], {
      q,
      ...filters,
    })

  const initializeFts = () => {
    sqlite.exec(ftsSchema)
    sqlite.exec(`
      INSERT INTO search_index_fts(rowid, lcsc, search_text)
      SELECT rowid + 100, lcsc, search_text FROM search_index;
      UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
    `)
  }

  test("legacy FTS rowids cannot return an unrelated component", async () => {
    sqlite.exec(`
      CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text);
      CREATE TABLE search_index_fts_meta (key TEXT PRIMARY KEY, value TEXT);
      INSERT INTO search_index_fts_meta VALUES ('ready', '1');
      INSERT INTO search_index_fts(rowid, search_text) VALUES
        (3, 'da14531 ble mcu'), (4, 'atsaml10e16a touch mcu');
    `)

    expect((await search("DA14531")).map((row) => row.lcsc)).toEqual([5334505])
    expect((await search("ATSAML10E16A")).map((row) => row.lcsc)).toEqual([
      2053058,
    ])
    expect(
      queries.some((query) => query.includes("JOIN search_index_fts")),
    ).toBe(false)
  })

  test("the versioned FTS index joins parts by LCSC rather than rowid", async () => {
    initializeFts()

    expect((await search("DA14531")).map((row) => row.lcsc)).toEqual([5334505])
    expect((await search("ATSAML10E16A")).map((row) => row.lcsc)).toEqual([
      2053058,
    ])
    expect(await search("unknown-mcu")).toEqual([])
    expect(
      queries.some((query) => query.includes("JOIN search_index_fts")),
    ).toBe(true)
  })

  test("catalog rowid changes cannot redirect an existing FTS match", async () => {
    initializeFts()
    // Simulate a catalog rebuild assigning different rowids to the same parts.
    sqlite.exec("UPDATE search_index SET rowid = rowid + 1000")

    expect((await search("DA14531")).map((row) => row.mfr)).toEqual([
      "DA14531-00000FX2",
    ])
    expect((await search("ATSAML10E16A")).map((row) => row.mfr)).toEqual([
      "ATSAML10E16A-MUT",
    ])
  })

  test("stale FTS text cannot make a nonmatching catalog row eligible", async () => {
    initializeFts()
    sqlite.exec(`
      INSERT INTO search_index_fts(lcsc, search_text)
      VALUES (659269, 'da14531 ble mcu');
      UPDATE search_index SET search_text = 'replacement converter'
      WHERE lcsc = 2053058;
    `)

    expect((await search("DA14531")).map((row) => row.lcsc)).toEqual([5334505])
    expect(await search("ATSAML10E16A")).toEqual([])
  })

  test.each([true, false])(
    "preserves stock, filters, ordering and limit with FTS ready=%s",
    async (ready) => {
      sqlite.exec(`
        INSERT INTO search_index
          (lcsc, mfr, package, description, stock, basic, preferred,
           category, subcategory, search_text)
        VALUES
          (990001, 'DA14531-A', 'QFN-24', 'BLE MCU', 90, 0, 1,
           'ICs', 'Microcontrollers', 'da14531 ble mcu'),
          (990002, 'DA14531-B', 'QFN-24', 'BLE MCU', 150, 1, 0,
           'ICs', 'Microcontrollers', 'da14531 ble mcu'),
          (990003, 'DA14531-C', 'QFN-32', 'BLE MCU', 200, 1, 1,
           'ICs', 'Microcontrollers', 'da14531 ble mcu'),
          (990004, 'DA14531-D', 'QFN-24', 'BLE MCU', 500, 1, 1,
           'ICs', 'Other', 'da14531 ble mcu'),
          (990005, 'DA14531-E', 'QFN-24', 'BLE MCU', 0, 1, 1,
           'ICs', 'Microcontrollers', 'da14531 ble mcu'),
          (990006, 'DA14531-F', 'QFN-24', 'BLE MCU', NULL, 1, 1,
           'ICs', 'Microcontrollers', 'da14531 ble mcu');
      `)
      initializeFts()
      if (!ready) {
        sqlite.exec(
          "UPDATE search_index_fts_meta SET value = '0' WHERE key = 'ready'",
        )
      }

      expect(
        (await search("DA14531", { limit: "2" })).map((row) => row.lcsc),
      ).toEqual([990004, 990003])
      expect(
        (await search("DA14531", { package: "QFN-24" })).map((row) => row.lcsc),
      ).toEqual([990004, 990002, 5334505, 990001])
      expect(
        (
          await search("DA14531", {
            package: "QFN-24",
            subcategory_name: "Microcontrollers",
            is_basic: "true",
            is_preferred: "1",
            limit: "1",
          })
        ).map((row) => row.lcsc),
      ).toEqual([5334505])
    },
  )

  test.each([
    "DROP TABLE search_index_fts_meta",
    "DELETE FROM search_index_fts_meta WHERE key = 'schema_version'",
    "UPDATE search_index_fts_meta SET value = '1' WHERE key = 'schema_version'",
    "UPDATE search_index_fts_meta SET value = '3' WHERE key = 'schema_version'",
    "UPDATE search_index_fts_meta SET value = '0' WHERE key = 'ready'",
  ])(
    "uses catalog LIKE search when FTS metadata is incompatible: %s",
    async (sql) => {
      initializeFts()
      sqlite.exec("DELETE FROM search_index_fts")
      sqlite.exec(sql)

      expect((await search("DA14531")).map((row) => row.lcsc)).toEqual([
        5334505,
      ])
    },
  )

  test("falls back if the FTS table is removed after being marked ready", async () => {
    initializeFts()
    sqlite.exec("DROP TABLE search_index_fts")

    expect((await search("DA14531")).map((row) => row.lcsc)).toEqual([5334505])
  })

  test("falls back if a ready index has lost its LCSC column", async () => {
    initializeFts()
    sqlite.exec(`
      DROP TABLE search_index_fts;
      CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text);
    `)

    expect((await search("DA14531")).map((row) => row.lcsc)).toEqual([5334505])
  })

  test("numeric and C-prefixed lookups do not depend on FTS readiness", async () => {
    for (const q of ["5334505", "C5334505", "c5334505"]) {
      expect((await search(q)).map((row) => row.lcsc)).toEqual([5334505])
    }
    expect(await search("C99999999")).toEqual([])
  })

  test("database failures unrelated to FTS are not suppressed", async () => {
    initializeFts()
    sqlite.exec("DROP TABLE search_index")

    await expect(search("DA14531")).rejects.toThrow(
      "no such table: search_index",
    )
  })
})
