import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const projectRoot = join(import.meta.dir, "..")
const readProjectFile = (path: string) =>
  readFileSync(join(projectRoot, path), "utf8")

const compositeIndexes = [
  ["idx_search_index_package_stock", "package, stock DESC"],
  ["idx_search_index_subcategory_stock", "subcategory, stock DESC"],
  ["idx_search_index_basic_stock", "basic, stock DESC"],
  ["idx_search_index_preferred_stock", "preferred, stock DESC"],
] as const

const getIndexNames = (db: Database, table: string) =>
  (
    db.query(`PRAGMA index_list("${table}")`).all() as Array<{ name: string }>
  ).map((index) => index.name)

const createNextTable = `CREATE TABLE search_index_next (
  lcsc INTEGER,
  mfr TEXT,
  package TEXT,
  description TEXT,
  stock INTEGER,
  price TEXT,
  price1 REAL,
  basic INTEGER,
  preferred INTEGER,
  extended_promotional INTEGER,
  category TEXT,
  subcategory TEXT,
  manufacturer_name TEXT,
  title TEXT,
  mpn TEXT,
  attributes TEXT,
  search_text TEXT
)`

const nextIndexSql = compositeIndexes
  .map(
    ([name, columns]) =>
      `CREATE INDEX IF NOT EXISTS ${name.replace("idx_search_index_", "idx_search_index_next_")} ON search_index_next(${columns});`,
  )
  .join("\n")

describe("search index composite-index parity", () => {
  test("preserves the current and next-table composite indexes", () => {
    const db = new Database(":memory:")
    try {
      db.run(readProjectFile("cf-proxy/migrations/0000_catalog_bootstrap.sql"))
      for (const table of [
        "dimm_connector",
        "sodimm_connector",
        "hdmi_port",
        "photo_diode",
        "micro_usb_connector",
        "barrel_jack",
        "dram",
        "npu_chip",
        "linux_capable_processor",
        "psram",
      ]) {
        db.run(`CREATE TABLE "${table}" (lcsc INTEGER)`)
      }
      db.run(
        readProjectFile("cf-proxy/migrations/0011_extended_promotional.sql"),
      )

      const currentNames = getIndexNames(db, "search_index")
      for (const [name] of compositeIndexes) {
        expect(currentNames).toContain(name)
      }

      db.run(createNextTable)
      db.run(nextIndexSql)
      db.run(nextIndexSql)
      const nextNames = getIndexNames(db, "search_index_next")
      for (const [name] of compositeIndexes) {
        expect(nextNames).toContain(
          name.replace("idx_search_index_", "idx_search_index_next_"),
        )
      }

      db.run(
        "INSERT INTO search_index_next (lcsc, package, stock) VALUES (1, 'R', 10), (2, 'R', 20)",
      )
      const plan = db
        .query(
          "EXPLAIN QUERY PLAN SELECT lcsc FROM search_index_next INDEXED BY idx_search_index_next_package_stock WHERE package = 'R' ORDER BY stock DESC",
        )
        .all() as Array<{ detail: string }>
      expect(
        plan.some((entry) =>
          entry.detail.includes("idx_search_index_next_package_stock"),
        ),
      ).toBe(true)
    } finally {
      db.close()
    }
  })

  test("keeps cleanup and atomic-swap DDL in sync with the baseline", () => {
    const batched = readProjectFile(
      "cf-proxy/scripts/rebuild-search-index-batched.sh",
    )
    const baseline = readProjectFile(
      "cf-proxy/migrations/0000_catalog_bootstrap.sql",
    )
    const directRebuild = readProjectFile(
      "cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
    )

    for (const [name, columns] of compositeIndexes) {
      const nextName = name.replace(
        "idx_search_index_",
        "idx_search_index_next_",
      )
      expect(baseline).toContain(`CREATE INDEX IF NOT EXISTS ${name}`)
      expect(directRebuild).toContain(
        `CREATE INDEX IF NOT EXISTS ${name} ON search_index(${columns})`,
      )
      expect(batched).toContain(
        `CREATE INDEX IF NOT EXISTS ${nextName} ON search_index_next(${columns})`,
      )
      expect(batched).toContain(`DROP INDEX IF EXISTS ${name}`)
      expect(batched).toContain(
        `CREATE INDEX IF NOT EXISTS ${name} ON search_index(${columns})`,
      )
    }
  })
})
