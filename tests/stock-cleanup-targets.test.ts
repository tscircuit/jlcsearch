import { expect, test } from "bun:test"
import {
  indexedStockCleanupTargets,
  PUBLISHED_STOCK_CLEANUP_TABLES,
} from "../scripts/stock-cleanup-targets"
import { stockDatabase } from "./fixtures/live-stock"

test("cleanup allowlist matches the tables published by sync-db.sh", async () => {
  const script = await Bun.file(
    new URL("../cf-proxy/scripts/sync-db.sh", import.meta.url),
  ).text()
  const derived = script
    .match(/\nDERIVED_TABLES=\(\s*([\s\S]*?)\n\)/)?.[1]
    .trim()
    .split(/\s+/)
  expect(derived).toBeDefined()
  expect([...PUBLISHED_STOCK_CLEANUP_TABLES].sort()).toEqual(
    ["component_catalog", "search_index", ...derived!].sort(),
  )
})

test("realistic published schemas use indexed pagination, while partial or unsuitable indexes are skipped", async () => {
  const { db, execute } = await stockDatabase()
  try {
    db.exec(`DROP TABLE search_index;
      CREATE TABLE search_index(lcsc INTEGER,stock INTEGER,search_text TEXT);
      CREATE INDEX idx_search_index_lcsc ON search_index(lcsc);
      CREATE TABLE resistor(lcsc INTEGER,stock INTEGER);
      CREATE INDEX idx_resistor_partial ON resistor(lcsc) WHERE stock IS NOT NULL;
      CREATE TABLE capacitor(lcsc INTEGER,stock INTEGER);
      CREATE INDEX idx_capacitor_wrong_order ON capacitor(stock,lcsc);
      CREATE TABLE diode(lcsc INTEGER,stock INTEGER);
      CREATE INDEX idx_diode_desc ON diode(lcsc DESC);`)
    const targets = [
      "component_catalog",
      "search_index",
      "switch",
      "resistor",
      "capacitor",
      "diode",
    ].map((name) => ({ name, has_in_stock: 0 }))
    const eligible = await indexedStockCleanupTargets(execute, targets)
    expect(eligible.map((t) => t.name)).toEqual([
      "component_catalog",
      "search_index",
      "switch",
      "diode",
    ])
  } finally {
    db.close()
  }
})

test("missing or malformed query plans fail closed before cleanup can run", async () => {
  for (const plan of [[], [{}], [{ detail: null }]]) {
    await expect(
      indexedStockCleanupTargets(
        async () => plan,
        [{ name: "search_index", has_in_stock: 0 }],
      ),
    ).rejects.toThrow("Invalid cleanup query plan")
  }
})
