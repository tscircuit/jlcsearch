import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { searchIndex } from "../../cf-proxy/src/search"

// J3 and U5 from https://tscircuit.com/gokul/pocket-audio-player,
// version 0.4.0-rc.9, output/fabrication/bom-jlcpcb.csv.
// Only identifiers are copied; stock counts are fixed test inputs.
const boardParts = [
  { reference: "J3", mfr: "PJ-320D", partial: "PJ-320", lcsc: 431535 },
  { reference: "U5", mfr: "XC6206P182MR", partial: "XC6206", lcsc: 21659 },
]

async function createSearchDatabase() {
  const sqlite = new Database(":memory:")
  sqlite.exec(`CREATE TABLE search_index (
    lcsc INTEGER, mfr TEXT, package TEXT, description TEXT,
    stock INTEGER, price TEXT, price1 REAL, basic INTEGER,
    preferred INTEGER, category TEXT, subcategory TEXT, search_text TEXT
  )`)
  for (const part of boardParts) {
    sqlite
      .query(
        "INSERT INTO search_index (lcsc, mfr, stock, search_text) VALUES (?, ?, 100, ?)",
      )
      .run(part.lcsc, part.mfr, part.mfr.toLowerCase())
  }
  sqlite.exec(
    await Bun.file(
      new URL("../../cf-proxy/scripts/setup-fts5.sql", import.meta.url),
    ).text(),
  )
  populateSearchFts(sqlite)
  const statements: string[] = []
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === "query") statements.push(event.query.sql)
    },
  })
  return {
    sqlite,
    db,
    statements,
  }
}

function populateSearchFts(sqlite: Database) {
  sqlite.exec(`
    DELETE FROM search_index_fts;
    INSERT INTO search_index_fts(rowid, search_text)
      SELECT lcsc, search_text FROM search_index;
    UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
  `)
}

function rebuildCatalog(sqlite: Database) {
  // Catalog replacement can assign new rowids while the old FTS stays ready.
  sqlite.exec(`
    CREATE TABLE search_index_next AS
      SELECT * FROM search_index ORDER BY lcsc;
    ALTER TABLE search_index RENAME TO search_index_old;
    ALTER TABLE search_index_next RENAME TO search_index;
  `)
}

for (const useFts of [true, false]) {
  test(`matching alternatives retain stock ordering (FTS ${useFts})`, async () => {
    const { sqlite, db } = await createSearchDatabase()
    try {
      sqlite.exec(`
        INSERT INTO search_index (lcsc, mfr, stock, search_text)
          VALUES (1, 'PJ-320D-OTHER', 1000, 'pj-320d-other');
      `)
      populateSearchFts(sqlite)
      if (!useFts)
        sqlite.exec(
          "UPDATE search_index_fts_meta SET value = '0' WHERE key = 'ready'",
        )
      expect(
        (await searchIndex(db, { q: "  pj-320d  " })).map((part) => part.lcsc),
      ).toEqual([1, 431535])
      expect(
        (await searchIndex(db, { q: "PJ-320D", limit: "1" })).map(
          (part) => part.lcsc,
        ),
      ).toEqual([1])
      expect(
        (await searchIndex(db, { q: "pj-320" })).map((part) => part.lcsc),
      ).toEqual([1, 431535])
      for (const stock of [0, null]) {
        sqlite
          .query("UPDATE search_index SET stock = ? WHERE lcsc = 431535")
          .run(stock)
        expect(
          (await searchIndex(db, { q: "PJ-320D" })).map((part) => part.lcsc),
        ).toEqual([1])
      }
      sqlite.exec(
        "UPDATE search_index SET stock = 100, package = 'THT' WHERE lcsc = 431535; UPDATE search_index SET package = 'SMD' WHERE lcsc = 1",
      )
      expect(
        (await searchIndex(db, { q: "PJ-320D", package: "SMD" })).map(
          (part) => part.lcsc,
        ),
      ).toEqual([1])
    } finally {
      await db.destroy()
    }
  })
}

test("exact part numbers respect filters, stock ordering and limit", async () => {
  const { sqlite, db } = await createSearchDatabase()
  try {
    rebuildCatalog(sqlite)
    sqlite.exec(`
      UPDATE search_index SET package = 'SMD', subcategory = 'Audio Connectors',
        basic = 1, preferred = 1 WHERE lcsc = 431535;
      INSERT INTO search_index (lcsc, mfr, stock, package, subcategory, basic, preferred, search_text)
        VALUES (1, 'PJ-320D', 200, 'SMD', 'Audio Connectors', 1, 1, 'pj-320d');
      INSERT INTO search_index (lcsc, mfr, stock, package, subcategory, basic, preferred, search_text)
        VALUES (2, 'PJ-320D', 300, 'THT', 'Audio Connectors', 1, 1, 'pj-320d');
    `)
    populateSearchFts(sqlite)
    const filters = {
      q: "PJ-320D",
      package: "SMD",
      subcategory_name: "Audio Connectors",
      is_basic: "true",
      is_preferred: "1",
      limit: "1",
    }
    expect((await searchIndex(db, filters)).map((part) => part.lcsc)).toEqual([
      1,
    ])
    for (const excluded of [
      { package: "DIP" },
      { subcategory_name: "Resistors" },
    ]) {
      expect(await searchIndex(db, { ...filters, ...excluded })).toEqual([])
    }
    for (const column of ["basic", "preferred"]) {
      sqlite.exec(`UPDATE search_index SET ${column} = 0`)
      expect(await searchIndex(db, filters)).toEqual([])
      sqlite.exec(`UPDATE search_index SET ${column} = 1`)
    }
    for (const stock of [0, null]) {
      sqlite
        .query("UPDATE search_index SET stock = ? WHERE mfr = 'PJ-320D'")
        .run(stock)
      expect(await searchIndex(db, { q: "PJ-320D" })).toEqual([])
    }
  } finally {
    await db.destroy()
  }
})

test("text searches use readiness plus one search query; LCSC lookups use one query", async () => {
  const { db, statements } = await createSearchDatabase()
  try {
    await searchIndex(db, { q: "PJ-320D" })
    expect(statements).toHaveLength(2)
    expect(statements[1]).toContain(
      "search_index_fts.rowid = search_index.lcsc",
    )
    statements.length = 0
    await searchIndex(db, { q: "C431535" })
    expect(statements).toHaveLength(1)
  } finally {
    await db.destroy()
  }
})

test("stale FTS text cannot return a catalog row that no longer matches", async () => {
  const { sqlite, db } = await createSearchDatabase()
  try {
    sqlite.exec(
      "UPDATE search_index SET mfr = 'UNRELATED', search_text = 'unrelated' WHERE lcsc = 431535",
    )
    expect(await searchIndex(db, { q: "PJ-320" })).toEqual([])
  } finally {
    await db.destroy()
  }
})

for (const indexState of [
  "aligned",
  "stale",
  "disabled",
  "legacy",
  "missing",
] as const) {
  test.each(boardParts)(
    `$reference: name and LCSC searches agree with ${indexState} FTS index`,
    async (part) => {
      const { sqlite, db } = await createSearchDatabase()
      try {
        if (indexState === "legacy") {
          sqlite.exec(`
            DROP TABLE search_index_fts;
            CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
            INSERT INTO search_index_fts(rowid, search_text) SELECT rowid, search_text FROM search_index;
            DELETE FROM search_index_fts_meta WHERE key = 'rowid_source';
          `)
        }
        if (indexState === "missing") sqlite.exec("DROP TABLE search_index_fts")
        if (indexState !== "aligned") {
          rebuildCatalog(sqlite)
        }
        if (indexState === "disabled") {
          sqlite.exec(
            "UPDATE search_index_fts_meta SET value = '0' WHERE key = 'ready'",
          )
        }
        const byCode = await searchIndex(db, { q: `C${part.lcsc}` })
        expect(byCode.map(({ lcsc, mfr }) => ({ lcsc, mfr }))).toEqual([
          { lcsc: part.lcsc, mfr: part.mfr },
        ])
        const byName = await searchIndex(db, { q: part.mfr })
        expect(byName).toEqual(byCode)
        expect(await searchIndex(db, { q: part.partial })).toEqual(byCode)
      } finally {
        await db.destroy()
      }
    },
  )
}
