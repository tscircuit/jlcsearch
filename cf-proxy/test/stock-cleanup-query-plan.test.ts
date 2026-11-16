import { expect, it } from "vitest"
import { indexedStockCleanupTargets } from "../../scripts/stock-cleanup-targets"

const workerTest = "Bun" in globalThis ? it.skip : it

workerTest(
  "D1 query plans distinguish published indexed tables from unsafe cleanup targets",
  async () => {
    const { env } = await import("cloudflare:test")
    for (const sql of [
      "CREATE TABLE component_catalog(lcsc INTEGER PRIMARY KEY,stock INTEGER)",
      "CREATE TABLE search_index(lcsc INTEGER,stock INTEGER)",
      "CREATE INDEX idx_search_index_lcsc ON search_index(lcsc)",
      "CREATE TABLE resistor(lcsc INTEGER,stock INTEGER)",
      "CREATE TABLE search_index_next(lcsc INTEGER,stock INTEGER)",
    ])
      await env.DB.prepare(sql).run()
    const targets = [
      "component_catalog",
      "search_index",
      "resistor",
      "search_index_next",
    ].map((name) => ({ name, has_in_stock: 0 }))
    const queried: string[] = []
    const eligible = await indexedStockCleanupTargets(async (sql) => {
      queried.push(sql)
      return (await env.DB.prepare(sql).all()).results
    }, targets)
    expect(eligible.map((t) => t.name)).toEqual([
      "component_catalog",
      "search_index",
    ])
    expect(queried.every((sql) => sql.startsWith("EXPLAIN QUERY PLAN"))).toBe(
      true,
    )
    expect(queried.some((sql) => sql.includes("search_index_next"))).toBe(false)
  },
)
