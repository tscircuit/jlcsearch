import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { queryComponentCatalog } from "../src/components"
import type { DB } from "../src/db/types"
import { searchIndex } from "../src/search"
import { createSelf, createTestEnv } from "./test-env"

describe("is_extended_promotional catalog and search filtering", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE search_index (
      rowid INTEGER PRIMARY KEY,
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
    CREATE TABLE search_index_fts_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT INTO search_index_fts_meta (key, value) VALUES ('ready', '0');

    INSERT INTO search_index (
      rowid, lcsc, mfr, package, description, stock, price, price1,
      basic, preferred, is_extended_promotional, category, subcategory,
      manufacturer_name, title, mpn, attributes, search_text
    ) VALUES
      (1, 1001, 'PART-BASE', 'SOT-23', 'Basic part', 100, '1:0.1', 0.1, 1, 0, 0, 'Resistors', 'Chip Resistor', 'Mfr1', 'Title1', 'PART-BASE', '{}', 'part-base'),
      (2, 1002, 'PART-EXT-PROMO', 'SOT-23', 'Ext Promo part', 200, '1:0.2', 0.2, 0, 1, 1, 'Resistors', 'Chip Resistor', 'Mfr2', 'Title2', 'PART-EXT-PROMO', '{}', 'part-ext-promo'),
      (3, 1003, 'PART-EXT-REG', 'SOT-23', 'Ext Regular part', 300, '1:0.3', 0.3, 0, 0, 0, 'Resistors', 'Chip Resistor', 'Mfr3', 'Title3', 'PART-EXT-REG', '{}', 'part-ext-reg');
  `)

  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database }),
  })

  it("filters searchIndex results by is_extended_promotional=true", async () => {
    const results = await searchIndex(db, { is_extended_promotional: "true" })
    expect(results).toHaveLength(1)
    expect(results[0].lcsc).toBe(1002)
    expect(results[0].mfr).toBe("PART-EXT-PROMO")
    expect(results[0].is_extended_promotional).toBe(1)
    expect(results[0].basic).toBe(0)
    expect(results[0].preferred).toBe(1)
  })

  it("filters searchIndex results by is_extended_promotional=1", async () => {
    const results = await searchIndex(db, { is_extended_promotional: "1" })
    expect(results).toHaveLength(1)
    expect(results[0].lcsc).toBe(1002)
  })

  it("filters queryComponentCatalog results by is_extended_promotional", async () => {
    const results = await queryComponentCatalog(db, {
      is_extended_promotional: "true",
    })
    expect(results).toHaveLength(1)
    expect(results[0].lcsc).toBe(1002)
    expect(results[0].is_extended_promotional).toBe(1)
  })

  it("returns all components when is_extended_promotional filter is not specified", async () => {
    const results = await searchIndex(db, {})
    expect(results).toHaveLength(3)
  })

  it("serves /components/list.json filtered by is_extended_promotional via worker", async () => {
    const env = createTestEnv()
    env.USE_D1 = "true"
    env.DB = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          all: async () => {
            const stmt = database.query(sql)
            const results = stmt.all(...params)
            return { results, meta: { changes: 0 } }
          },
          raw: async () => {
            const stmt = database.query(sql)
            return stmt.values(...params)
          },
        }),
      }),
    } as unknown as D1Database

    const self = createSelf(env)
    const response = await self.fetch(
      "https://example.com/components/list?json=true&is_extended_promotional=true",
      { headers: { accept: "application/json" } },
    )

    expect(response.status).toBe(200)
    const data = (await response.json()) as any
    expect(data.components).toHaveLength(1)
    expect(data.components[0].lcsc).toBe(1002)
    expect(data.components[0].is_basic).toBe(false)
    expect(data.components[0].is_preferred).toBe(true)
    expect(data.components[0].is_extended_promotional).toBe(true)
  })

  it("serves /api/search filtered by is_extended_promotional via worker", async () => {
    const env = createTestEnv()
    env.USE_D1 = "true"
    env.DB = {
      prepare: (sql: string) => ({
        bind: (...params: any[]) => ({
          all: async () => {
            const stmt = database.query(sql)
            const results = stmt.all(...params)
            return { results, meta: { changes: 0 } }
          },
          raw: async () => {
            const stmt = database.query(sql)
            return stmt.values(...params)
          },
        }),
      }),
    } as unknown as D1Database

    const self = createSelf(env)
    const response = await self.fetch(
      "https://example.com/api/search?is_extended_promotional=true",
      { headers: { accept: "application/json" } },
    )

    expect(response.status).toBe(200)
    const data = (await response.json()) as any
    expect(data.components).toHaveLength(1)
    expect(data.components[0].lcsc).toBe(1002)
    expect(data.components[0].is_basic).toBe(false)
    expect(data.components[0].is_preferred).toBe(true)
    expect(data.components[0].is_extended_promotional).toBe(true)
  })
})
