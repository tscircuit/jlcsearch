import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../../cf-proxy/src/db/types"
import { InvalidSearchQueryError, searchIndex } from "../../cf-proxy/src/search"

const fixture = () => {
  const sqlite = new Database(":memory:")
  sqlite.exec(`CREATE TABLE search_index (
    lcsc INTEGER UNIQUE, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
    price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
    subcategory TEXT, search_text TEXT);
    CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
    CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY,value TEXT);
    INSERT INTO search_index_fts_meta VALUES ('ready_lcsc','1');`)
  const texts = [
    "precision op amplifier",
    "precision amplifier",
    "generic op amplifier",
    "8mhz crystal",
    "8m crystal",
    "12mhz crystal",
    "12m crystal",
    "dc power receptacle",
    "ac power receptacle",
    "电源连接器",
  ]
  const insert = sqlite.query(
    "INSERT INTO search_index(lcsc,stock,search_text) VALUES(?,?,?)",
  )
  for (const [i, text] of texts.entries()) insert.run(i + 1, 1000 - i, text)
  for (let i = 100; i < 1105; i++) insert.run(i, i, "resistor 0805")
  sqlite.exec(
    "INSERT INTO search_index_fts(rowid,search_text) SELECT lcsc,search_text FROM search_index",
  )
  const queries: Array<{ sql: string; parameters: readonly unknown[] }> = []
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
    log: (event) => {
      queries.push(event.query)
    },
  })
  const search = (q?: string, limit?: string) =>
    searchIndex(db as unknown as Parameters<typeof searchIndex>[0], {
      q,
      limit,
    })
  return { db, sqlite, queries, search }
}

test("MATCH narrows all indexable terms while preserving short terms, aliases and substrings", async () => {
  const { db, search, queries, sqlite } = fixture()
  try {
    for (const [q, expected] of [
      ["precision op amp", [1]],
      ["8MHz crystal", [4, 5]],
      ["12MHz crystal", [6, 7]],
      ["5v barrel jack", [8]],
      ["电源连接", [10]],
      ['precision "OR" amplifier', []],
    ] as const) {
      expect((await search(q)).map((row) => row.lcsc)).toEqual([...expected])
    }
    await search("precision amplifier")
    const query = queries.at(-1)!
    expect(query.parameters).toContain('("precision") AND ("amplifier")')
    expect(query.sql).toContain("search_index_fts MATCH")
    expect(query.sql).not.toContain("search_index_fts.search_text LIKE")
    const plan = sqlite
      .query(`EXPLAIN QUERY PLAN ${query.sql}`)
      .all(...(query.parameters as any[])) as { detail: string }[]
    expect(
      plan.some((row) =>
        /search_index_fts VIRTUAL TABLE INDEX .*M/.test(row.detail),
      ),
    ).toBe(true)
  } finally {
    await db.destroy()
  }
})

test("search results retain stock ordering with default, explicit and maximum limits", async () => {
  const { db, search } = fixture()
  try {
    expect(await search("resistor")).toHaveLength(100)
    expect(await search("resistor", "1000")).toHaveLength(1000)
    expect((await search("resistor", "2")).map((row) => row.lcsc)).toEqual([
      1104, 1103,
    ])
  } finally {
    await db.destroy()
  }
})

test("invalid or unindexable searches are rejected before any database query", async () => {
  const { db, search, queries } = fixture()
  try {
    for (const limit of [
      "-1",
      "0",
      "1001",
      "1.5",
      "1e3",
      "10parts",
      "",
      "NaN",
      "9007199254740992",
    ])
      await expect(search("resistor", limit)).rejects.toBeInstanceOf(
        InvalidSearchQueryError,
      )
    for (const q of ["a", "zz", "op dc", "8MHz", "%___%", "x".repeat(257)])
      await expect(search(q)).rejects.toBeInstanceOf(InvalidSearchQueryError)
    expect(queries).toEqual([])
    // Very short numeric searches are exact identifiers and need no text index.
    expect((await search("C1")).map((row) => row.lcsc)).toEqual([1])
    expect((await search("1")).map((row) => row.lcsc)).toEqual([1])
    expect(await search()).toHaveLength(100)
  } finally {
    await db.destroy()
  }
})
