import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const projectRoot = join(import.meta.dir, "..")
const migrationsDirectory = join(projectRoot, "cf-proxy", "migrations")
const migrationFiles = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
const readMigration = (file: string) =>
  readFileSync(join(migrationsDirectory, file), "utf8")
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

const createMigrationPlaceholderTables = (db: Database) => {
  for (const table of migrationTables.slice(2)) {
    db.run(`CREATE TABLE "${table}" (lcsc INTEGER)`)
  }
}

describe("fresh D1 migration chain", () => {
  test("bootstraps catalog tables before applying the complete chain", () => {
    expect(migrationFiles[0]).toBe("0000_catalog_bootstrap.sql")

    const db = new Database(":memory:")
    try {
      for (const file of migrationFiles) {
        db.run(readMigration(file))
      }

      expect(getColumns(db, "component_catalog")).toContain(
        "extended_promotional",
      )
      expect(getColumns(db, "search_index")).toContain("extended_promotional")
      expect(
        db.query("SELECT COUNT(*) AS count FROM component_catalog").get(),
      ).toEqual({
        count: 0,
      })
    } finally {
      db.close()
    }
  })

  test("bootstrap is idempotent before and after the forward column migration", () => {
    const db = new Database(":memory:")
    try {
      const bootstrap = readMigration("0000_catalog_bootstrap.sql")
      db.run(bootstrap)
      db.run(bootstrap)
      expect(getColumns(db, "component_catalog")).not.toContain(
        "extended_promotional",
      )

      createMigrationPlaceholderTables(db)
      db.run(readMigration("0011_extended_promotional.sql"))
      db.run(bootstrap)
      expect(getColumns(db, "component_catalog")).toContain(
        "extended_promotional",
      )
      expect(getColumns(db, "search_index")).toContain("extended_promotional")
    } finally {
      db.close()
    }
  })
})
