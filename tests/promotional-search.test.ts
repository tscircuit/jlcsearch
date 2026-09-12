import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../cf-proxy/src/db/types"
import { queryComponentCatalog } from "../cf-proxy/src/components"
import { searchIndex } from "../cf-proxy/src/search"
import { renderD1TablePage } from "../cf-proxy/src/render"

test("catalog rebuild, search and HTML preserve/filter promotion membership", async () => {
  const sqlite = new Database(":memory:")
  sqlite.exec(`CREATE TABLE component_catalog (
    lcsc INTEGER, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
    price TEXT, basic INTEGER, preferred INTEGER, is_extended_promotional INTEGER,
    category TEXT, subcategory TEXT, extra TEXT
  );
  INSERT INTO component_catalog VALUES
    (1002, 'Basic bead', '0603', 'bead', 100, '1-:1', 1, 0, 0, 'Filters', 'Beads', '{}'),
    (1034, 'Promotional inductor', '0603', 'inductor', 90, '1-:1', 0, 1, 1, 'Filters', 'Inductors', '{}'),
    (2000, 'Ordinary preferred', '0603', 'other', 80, '1-:1', 0, 1, 0, 'Filters', 'Other', '{}'),
    (3000, 'Sold out promotion', '0603', 'other', 0, '1-:1', 0, 1, 1, 'Filters', 'Other', '{}');`)
  sqlite.exec(
    readFileSync(
      new URL(
        "../cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  )
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
  try {
    expect(
      (await searchIndex(db, {})).map((r) => [
        r.lcsc,
        r.is_extended_promotional,
      ]),
    ).toEqual([
      [1002, 0],
      [1034, 1],
      [2000, 0],
    ])
    expect(
      (await searchIndex(db, { is_extended_promotional: "true" })).map(
        (r) => r.lcsc,
      ),
    ).toEqual([1034])
    expect(
      (
        await searchIndex(db, {
          is_basic: "true",
          is_extended_promotional: "1",
        })
      ).map((r) => r.lcsc),
    ).toEqual([1002, 1034])
    expect(
      (
        await queryComponentCatalog(db, {
          is_extended_promotional: "true",
          package: "0603",
        })
      ).map((r) => r.lcsc),
    ).toEqual([1034])
    expect(
      await searchIndex(db, {
        is_extended_promotional: "true",
        package: "0805",
      }),
    ).toEqual([])
    expect(
      await searchIndex(db, { is_extended_promotional: "true", q: "C2000" }),
    ).toEqual([])
    expect(
      (
        await searchIndex(db, {
          is_extended_promotional: "true",
          q: "inductor",
        })
      ).map((r) => r.lcsc),
    ).toEqual([1034])
    sqlite.exec(`CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text);
      INSERT INTO search_index_fts(rowid, search_text) SELECT rowid, search_text FROM search_index;
      CREATE TABLE search_index_fts_meta(key TEXT, value TEXT);
      INSERT INTO search_index_fts_meta VALUES('ready', '1');`)
    expect(
      (
        await searchIndex(db, {
          is_extended_promotional: "true",
          q: "inductor",
        })
      ).map((r) => r.lcsc),
    ).toEqual([1034])
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          { lcsc: 1002, is_extended_promotional: false },
          { lcsc: 1034, is_extended_promotional: true },
        ],
      },
      { is_extended_promotional: "true" },
    )
    expect(html).toContain(
      'name="is_extended_promotional" value="true" checked',
    )
    expect(html).toContain("Extended Promotional</th>")
  } finally {
    await db.destroy()
    sqlite.close(true)
  }
})
