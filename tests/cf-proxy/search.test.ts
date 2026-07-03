import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { searchIndex } from "../../cf-proxy/src/search"

let db: Kysely<DB> | undefined
let sqlite: Database | undefined

afterEach(async () => {
  await db?.destroy()
  sqlite?.close()
  db = undefined
  sqlite = undefined
})

const createSearchDb = () => {
  sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE search_index (
      lcsc INTEGER,
      mfr TEXT,
      package TEXT,
      description TEXT,
      stock INTEGER,
      price TEXT,
      price1 REAL,
      basic INTEGER,
      preferred INTEGER,
      is_extended_promotional INTEGER,
      category TEXT,
      subcategory TEXT,
      manufacturer_name TEXT,
      title TEXT,
      mpn TEXT,
      attributes TEXT,
      search_text TEXT
    );

    INSERT INTO search_index (
      lcsc,
      mfr,
      package,
      description,
      stock,
      price,
      price1,
      basic,
      preferred,
      is_extended_promotional,
      category,
      subcategory,
      search_text
    ) VALUES
      (1001, 'PromoCo', '0603', 'extended promotional resistor', 100, '[]', 0.01, 0, 0, 1, 'Resistors', 'Chip Resistor', 'promo resistor'),
      (1002, 'StdCo', '0603', 'standard resistor', 100, '[]', 0.02, 0, 0, 0, 'Resistors', 'Chip Resistor', 'standard resistor');
  `)
  db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  })
  return db
}

test("searchIndex filters and returns extended promotional components", async () => {
  const rows = await searchIndex(createSearchDb() as any, {
    is_extended_promotional: "true",
  })

  expect(rows).toHaveLength(1)
  expect(rows[0]?.lcsc).toBe(1001)
  expect(rows[0]?.is_extended_promotional).toBe(1)
})
