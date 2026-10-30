import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { searchIndex } from "../../cf-proxy/src/search"

test("numeric and C-prefixed LCSC lookups retain zero and unknown stock while broad search excludes them", async () => {
  const sqlite = new Database(":memory:")
  sqlite.exec(`CREATE TABLE search_index (
    lcsc INTEGER, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
    price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
    subcategory TEXT, search_text TEXT);
    INSERT INTO search_index VALUES (9002,'crystal','SMD3225','12MHz',100,'0.10',0.10,1,0,'Crystals','Crystals','crystal 12mhz');`)
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
  try {
    const search = (q: string) =>
      searchIndex(db as unknown as Parameters<typeof searchIndex>[0], {
        q,
        limit: "10",
      })
    for (const q of ["9002", "C9002", "c9002"])
      expect((await search(q)).map((row) => row.lcsc)).toEqual([9002])
    for (const stock of [0, null]) {
      sqlite.query("UPDATE search_index SET stock=?").run(stock)
      for (const q of ["9002", "C9002"])
        expect(await search(q)).toMatchObject([{ lcsc: 9002, stock }])
      expect(await search("crystal")).toEqual([])
    }
  } finally {
    await db.destroy()
  }
})
