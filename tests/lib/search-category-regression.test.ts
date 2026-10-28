import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { searchIndex } from "../../cf-proxy/src/search"

test("crystal search matches catalog category text", async () => {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE search_index (
      lcsc INTEGER, mfr TEXT, package TEXT, description TEXT,
      stock INTEGER, price TEXT, price1 REAL, basic INTEGER,
      preferred INTEGER, category TEXT, subcategory TEXT, search_text TEXT
    );
    INSERT INTO search_index VALUES (
      9002, 'X322512MSB4SI', 'SMD3225-4P', '12MHz 20pF',
      100, '0.10', 0.10, 1, 0, 'Crystals', 'Crystals',
      'x322512msb4si 12mhz 20pf crystals'
    );
    INSERT INTO search_index VALUES (
      42, 'resistor', '0603', '10k resistor',
      1000, '0.01', 0.01, 1, 0, 'Resistors', 'Resistors',
      'resistor 10k resistors'
    );
  `)
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
  try {
    // The root and worker packages use different Kysely versions with private type brands.
    const rows = await searchIndex(
      db as unknown as Parameters<typeof searchIndex>[0],
      {
        q: "12MHz crystal",
        limit: "10",
      },
    )
    expect(rows.map((row) => row.lcsc)).toEqual([9002])
    expect(rows[0]?.basic).toBe(1)
  } finally {
    await db.destroy()
  }
})
