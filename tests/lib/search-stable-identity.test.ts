import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { searchIndex } from "../../cf-proxy/src/search"

test("legacy FTS falls back; stable-ID FTS survives catalog row reordering", async () => {
  const sqlite = new Database(":memory:")
  sqlite.exec(`CREATE TABLE search_index (
    lcsc INTEGER UNIQUE, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
    price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
    subcategory TEXT, search_text TEXT);
    INSERT INTO search_index(lcsc,mfr,stock,search_text) VALUES
      (42388007,'RK3576',487,'rockchip rk3576'), (1,'SMBJ6.5CA',100,'tvs diode');
    CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
    CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY,value TEXT);
    INSERT INTO search_index_fts_meta VALUES ('ready','1');
    INSERT INTO search_index_fts(rowid,search_text) VALUES (2,'rockchip rk3576');`)
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
  const client = db as unknown as Parameters<typeof searchIndex>[0]
  const search = () => searchIndex(client, { q: "RK3576" })
  try {
    // An old ready marker must never enable the misaligned legacy index.
    expect((await search()).map((r) => r.lcsc)).toEqual([42388007])
    sqlite.exec(`DELETE FROM search_index_fts;
      INSERT INTO search_index_fts(rowid,search_text) SELECT lcsc,search_text FROM search_index;
      INSERT INTO search_index_fts_meta VALUES ('ready_lcsc','1');
      UPDATE search_index SET rowid=99 WHERE lcsc=42388007;`)
    expect((await search()).map((r) => r.lcsc)).toEqual([42388007])
    // Also reject stale text for a different part instead of returning a false hit.
    sqlite.exec(
      `UPDATE search_index_fts SET search_text='rk3576' WHERE rowid=1;`,
    )
    expect((await search()).map((r) => r.lcsc)).toEqual([42388007])
    sqlite.exec(`UPDATE search_index SET stock=0 WHERE lcsc=42388007;`)
    expect(await search()).toEqual([])
    expect((await searchIndex(client, { q: "C42388007" }))[0].stock).toBe(0)
  } finally {
    await db.destroy()
  }
})
