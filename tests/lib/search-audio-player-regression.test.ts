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
  { reference: "J3", mfr: "PJ-320D", lcsc: 431535 },
  { reference: "U5", mfr: "XC6206P182MR", lcsc: 21659 },
]

async function createSearchDatabase() {
  const sqlite = new Database(":memory:")
  sqlite.exec(
    await Bun.file(
      new URL(
        "../../cf-proxy/migrations/0018_search_index_mfr.sql",
        import.meta.url,
      ),
    ).text(),
  )
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
  // Populate rowids exactly as rebuild-search-index-fts-batched.sh does.
  sqlite.exec(`
    INSERT INTO search_index_fts(rowid, search_text)
      SELECT rowid, search_text FROM search_index;
    UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
  `)
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
  // Root and worker Kysely packages have distinct private type brands.
  return { sqlite, db: db as typeof db & Parameters<typeof searchIndex>[0] }
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

test("exact part numbers ignore case and take precedence over partial matches", async () => {
  const { sqlite, db } = await createSearchDatabase()
  try {
    sqlite.exec(`
      INSERT INTO search_index (lcsc, mfr, stock, search_text)
        VALUES (1, 'PJ-320D-OTHER', 1000, 'pj-320d-other');
      INSERT INTO search_index_fts(rowid, search_text)
        SELECT rowid, search_text FROM search_index WHERE lcsc = 1;
    `)
    expect(
      (await searchIndex(db, { q: "  pj-320d  " })).map((part) => part.lcsc),
    ).toEqual([431535])
    // A non-exact query still uses the existing token search and stock ordering.
    expect(
      (await searchIndex(db, { q: "pj-320" })).map((part) => part.lcsc),
    ).toEqual([1, 431535])
  } finally {
    await db.destroy()
  }
})

test("exact part numbers respect filters, stock ordering and limit", async () => {
  const { sqlite, db } = await createSearchDatabase()
  try {
    rebuildCatalog(sqlite)
    sqlite.exec(`
      UPDATE search_index SET package = 'SMD', subcategory = 'Audio Connectors',
        basic = 1, preferred = 1 WHERE lcsc = 431535;
      INSERT INTO search_index (lcsc, mfr, stock, package, subcategory, basic, preferred)
        VALUES (1, 'PJ-320D', 200, 'SMD', 'Audio Connectors', 1, 1);
      INSERT INTO search_index (lcsc, mfr, stock, package, subcategory, basic, preferred)
        VALUES (2, 'PJ-320D', 300, 'THT', 'Audio Connectors', 1, 1);
    `)
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

test("exact lookup uses the manufacturer index and migration preserves existing parts", async () => {
  const { sqlite, db } = await createSearchDatabase()
  try {
    sqlite.exec(
      await Bun.file(
        new URL(
          "../../cf-proxy/migrations/0018_search_index_mfr.sql",
          import.meta.url,
        ),
      ).text(),
    )
    expect(
      sqlite.query("SELECT COUNT(*) AS count FROM search_index").get(),
    ).toEqual({ count: 2 })
    const plan = sqlite
      .query<{ detail: string }, [string]>(
        "EXPLAIN QUERY PLAN SELECT lcsc FROM search_index WHERE mfr = ? COLLATE NOCASE AND stock > 0 ORDER BY stock DESC LIMIT 10",
      )
      .all("PJ-320D")
    expect(
      plan.some((step) =>
        step.detail.includes("USING INDEX idx_search_index_mfr_stock"),
      ),
    ).toBe(true)
    expect(plan.some((step) => step.detail.includes("SCAN search_index"))).toBe(
      false,
    )
  } finally {
    await db.destroy()
  }
})

for (const indexState of ["aligned", "stale", "disabled"] as const) {
  test.each(boardParts)(
    `$reference: name and LCSC searches agree with ${indexState} FTS index`,
    async (part) => {
      const { sqlite, db } = await createSearchDatabase()
      try {
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
      } finally {
        await db.destroy()
      }
    },
  )
}
