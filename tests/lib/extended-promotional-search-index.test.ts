import { Database, type SQLQueryBindings } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { getD1Client } from "../../cf-proxy/src/db/get-d1-client"
import { searchIndex } from "../../cf-proxy/src/search"

declare global {
  interface D1Database {
    prepare: (...args: any[]) => any
    batch: (...args: any[]) => any
    exec: (...args: any[]) => any
    withSession: (...args: any[]) => any
    dump: (...args: any[]) => any
  }
}

const sqlite = new Database(":memory:")

const d1 = {
  prepare(sql: string) {
    let parameters: SQLQueryBindings[] = []

    return {
      bind(...values: SQLQueryBindings[]) {
        parameters = values
        return this
      },
      async all() {
        try {
          const results = sqlite.query(sql).all(...parameters)
          const changes = sqlite.query("SELECT changes() AS changes").get() as {
            changes: number
          }

          return {
            results,
            meta: { changes: changes.changes, last_row_id: null },
          }
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            results: [],
            meta: { changes: 0, last_row_id: null },
          }
        }
      },
    }
  },
} as unknown as D1Database

afterEach(() => {
  sqlite.exec("DROP TABLE IF EXISTS search_index")
  sqlite.exec("DROP TABLE IF EXISTS search_index_fts_meta")
})

test("searchIndex filters and returns extended promotional components", async () => {
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
      search_text TEXT
    );
    INSERT INTO search_index VALUES
      (1, 'PROMO', '0603', 'Promotional part', 10, '[]', 0.1, 0, 1, 1, 'Passives', 'Resistors', 'promo promotional part'),
      (2, 'REGULAR', '0603', 'Regular part', 10, '[]', 0.2, 0, 0, 0, 'Passives', 'Resistors', 'regular part');
  `)

  const db = getD1Client(d1)
  const rows = await searchIndex(db, { is_extended_promotional: "true" })

  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    lcsc: 1,
    mfr: "PROMO",
    is_extended_promotional: 1,
  })

  await db.destroy()
})
