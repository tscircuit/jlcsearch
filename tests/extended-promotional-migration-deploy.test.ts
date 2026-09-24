import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const projectRoot = join(import.meta.dir, "..")
const readProjectFile = (path: string) =>
  readFileSync(join(projectRoot, path), "utf8")

const migrationTables = [
  "component_catalog",
  "search_index",
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
]

const getColumns = (db: Database, table: string) =>
  (
    db.query(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
  ).map((column) => column.name)

describe("extended promotional D1 migration and deploy path", () => {
  test("adds the column to an existing database without dropping tables", () => {
    const db = new Database(":memory:")
    try {
      for (const table of migrationTables) {
        db.run(`CREATE TABLE "${table}" (lcsc INTEGER)`)
      }
      db.run(
        readProjectFile("cf-proxy/migrations/0011_extended_promotional.sql"),
      )

      expect(getColumns(db, "component_catalog")).toContain(
        "extended_promotional",
      )
      expect(getColumns(db, "search_index")).toContain("extended_promotional")
      for (const table of migrationTables.slice(2)) {
        expect(getColumns(db, table)).toContain("is_extended_promotional")
      }
    } finally {
      db.close()
    }
  })

  test("keeps applied migration history free of the new column", () => {
    for (const path of [
      "cf-proxy/migrations/0000_catalog_bootstrap.sql",
      "cf-proxy/migrations/0001_memory_connector_tables.sql",
      "cf-proxy/migrations/0002_hdmi_port.sql",
      "cf-proxy/migrations/0003_photo_diode.sql",
      "cf-proxy/migrations/0005_micro_usb_connector.sql",
      "cf-proxy/migrations/0006_barrel_jack.sql",
      "cf-proxy/migrations/0007_dram.sql",
      "cf-proxy/migrations/0008_npu_chip.sql",
      "cf-proxy/migrations/0009_linux_capable_processor.sql",
      "cf-proxy/migrations/0010_psram.sql",
    ]) {
      expect(readProjectFile(path)).not.toContain("extended_promotional")
    }
  })

  test("projects and rebuilds the field through search data", () => {
    const search = readProjectFile("cf-proxy/src/search.ts")
    const sync = readProjectFile("cf-proxy/scripts/sync-db.sh")
    const rebuild = readProjectFile(
      "cf-proxy/scripts/rebuild-search-index-batched.sh",
    )
    const rebuildSql = readProjectFile(
      "cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
    )

    expect(search).toMatch(
      /search_index\.preferred,\s+search_index\.extended_promotional/,
    )
    expect(sync).toMatch(/preferred,\s+extended_promotional/)
    expect(sync).toMatch(/preferred INTEGER,\s+extended_promotional INTEGER/)
    expect(rebuild).toMatch(/preferred INTEGER,\s+extended_promotional INTEGER/)
    expect(rebuild).toMatch(/preferred,\s+extended_promotional/)
    expect(rebuildSql).toMatch(/preferred,\s+extended_promotional/)
  })

  test("migrates, verifies, rebuilds, refreshes FTS, and deploys in order", () => {
    const deploy = readProjectFile("cf-proxy/scripts/deploy.sh")
    const bootstrapIndex = deploy.indexOf("bootstrap-catalog.sh")
    const migrationIndex = deploy.indexOf("d1 migrations apply")
    const verifyIndex = deploy.indexOf("SELECT extended_promotional")
    const rebuildIndex = deploy.indexOf("rebuild-search-index-batched.sh")
    const ftsIndex = deploy.indexOf("rebuild-search-index-fts-batched.sh")
    const deployIndex = deploy.lastIndexOf("wrangler deploy")

    expect(bootstrapIndex).toBeGreaterThanOrEqual(0)
    expect(bootstrapIndex).toBeLessThan(migrationIndex)
    expect(migrationIndex).toBeGreaterThanOrEqual(0)
    expect(verifyIndex).toBeGreaterThan(migrationIndex)
    expect(rebuildIndex).toBeGreaterThan(verifyIndex)
    expect(ftsIndex).toBeGreaterThan(rebuildIndex)
    expect(deployIndex).toBeGreaterThan(ftsIndex)
  })
})
