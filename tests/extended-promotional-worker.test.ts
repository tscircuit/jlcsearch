/// <reference path="../cf-proxy/node_modules/@cloudflare/workers-types/index.d.ts" />

import { Database, type SQLQueryBindings } from "bun:sqlite"
import { expect, test } from "bun:test"
import { createSelf, createTestEnv } from "../cf-proxy/test/test-env"

const createSqliteD1 = (database: Database): D1Database => {
  const prepare = (query: string, parameters: SQLQueryBindings[] = []) => ({
    bind: (...values: SQLQueryBindings[]) => prepare(query, values),
    all: async () => ({
      results: database
        .query<Record<string, unknown>, SQLQueryBindings[]>(query)
        .all(...parameters),
      success: true,
      meta: { changes: 0 },
    }),
  })

  return { prepare } as unknown as D1Database
}

test("worker filters and exposes extended promotional components", async () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE search_index (
      lcsc INTEGER PRIMARY KEY,
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
    INSERT INTO search_index (
      lcsc, mfr, package, description, stock, price, price1, basic, preferred,
      is_extended_promotional, category, subcategory, search_text
    ) VALUES
      (1001, 'HDMI-BASE', 'SMD', 'Base HDMI part', 100, '1-:1.25', 1.25,
       1, 1, 0, 'Connectors', 'HDMI', 'hdmi base'),
      (1002, 'HDMI-EXT', 'SMD', 'Extended promotional HDMI part', 200,
       '1-:1.50', 1.50, 0, 1, 1, 'Connectors', 'HDMI',
       'hdmi extended promotional'),
      (1003, 'HDMI-REGULAR-EXT', 'SMD', 'Regular extended HDMI part', 150,
       '1-:1.75', 1.75, 0, 0, 0, 'Connectors', 'HDMI',
       'hdmi regular extended');
  `)

  const env = createTestEnv()
  env.USE_D1 = "true"
  env.DB = createSqliteD1(database)
  const self = createSelf(env)

  try {
    const searchResponse = await self.fetch(
      "https://example.com/api/search?is_extended_promotional=true&cachebust=1",
      { headers: { accept: "application/json" } },
    )
    expect(searchResponse.status).toBe(200)
    expect((await searchResponse.json()) as any).toEqual({
      components: [
        expect.objectContaining({
          lcsc: 1002,
          is_extended_promotional: true,
        }),
      ],
    })

    const listResponse = await self.fetch(
      "https://example.com/components/list?json=true&is_extended_promotional=1&cachebust=1",
      { headers: { accept: "application/json" } },
    )
    expect(listResponse.status).toBe(200)
    expect((await listResponse.json()) as any).toEqual({
      components: [
        expect.objectContaining({
          lcsc: 1002,
          is_extended_promotional: true,
        }),
      ],
    })

    const htmlResponse = await self.fetch(
      "https://example.com/components/list?is_extended_promotional=true&cachebust=1",
      { headers: { accept: "text/html" } },
    )
    const html = await htmlResponse.text()
    expect(htmlResponse.status).toBe(200)
    expect(html).toContain(
      'name="is_extended_promotional" value="true" checked',
    )
    expect(html).toContain("HDMI-EXT")
    expect(html).not.toContain("HDMI-REGULAR-EXT")
  } finally {
    await self.flushWaitUntil()
    database.close()
  }
})
