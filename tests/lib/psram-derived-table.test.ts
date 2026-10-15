import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { psramTableSpec } from "lib/db/derivedtables/psram"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

// C5360305's description and category from the live component catalog.
const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 5360305,
    mfr: "APS6404L-SQN-ZR",
    description:
      "-40℃~+85℃ 0.3mA 1.62V~1.98V 64Mbit 7mA 7ns SPI、QPI USON-8(2x3) PSRAM ROHS",
    stock: 52,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 2.1429 }]),
    package: "USON-8(2x3)",
    extra: JSON.stringify({ attributes: {} }),
    ...overrides,
  }) as any

const EXPECTED_INDEX_COLUMNS = [
  "stock",
  "package,stock",
  "interface_type,stock",
  "memory_size_mbit,stock",
  "clock_frequency_mhz,stock",
  "is_basic,stock",
  "is_preferred,stock",
]

test("PSRAM extracts catalog descriptions without confusing access time with clock frequency", () => {
  expect(psramTableSpec.mapToTable([makeComponent()])[0]).toMatchObject({
    lcsc: 5360305,
    memory_size_mbit: 64,
    interface_type: "SPI, QPI",
    clock_frequency_mhz: null,
    supply_voltage_min: 1.62,
    supply_voltage_max: 1.98,
    operating_temp_min: -40,
    operating_temp_max: 85,
    is_preferred: true,
    price1: 2.1429,
  })
})

test("PSRAM prefers structured attributes and converts memory and frequency units", () => {
  for (const [size, expected] of [
    ["512Kbit", 0.5],
    ["2Gbit", 2048],
  ] as const) {
    expect(
      psramTableSpec.mapToTable([
        makeComponent({
          extra: JSON.stringify({
            attributes: {
              "Memory Size": size,
              "Clock Frequency": "0.2GHz",
              "Interface Type": "OPI",
              "Supply Voltage": "2.7V~3.6V",
            },
          }),
        }),
      ])[0],
    ).toMatchObject({
      memory_size_mbit: expected,
      clock_frequency_mhz: 200,
      interface_type: "OPI",
      supply_voltage_min: 2.7,
      supply_voltage_max: 3.6,
    })
  }
})

test("PSRAM falls back from placeholder attributes and preserves unknown values", () => {
  expect(
    psramTableSpec.mapToTable([
      makeComponent({
        extra: JSON.stringify({
          attributes: {
            "Memory Size": "-",
            "Clock Frequency": "-",
            "Interface Type": "-",
          },
        }),
      }),
    ])[0],
  ).toMatchObject({ memory_size_mbit: 64, interface_type: "SPI, QPI" })
  expect(
    psramTableSpec.mapToTable([
      makeComponent({ description: "SOP-8 PSRAM ROHS", extra: null }),
    ])[0],
  ).toMatchObject({
    memory_size_mbit: null,
    clock_frequency_mhz: null,
    interface_type: null,
    supply_voltage_min: null,
    operating_temp_min: null,
  })
  expect(psramTableSpec.mapToTable([makeComponent({ extra: "{" })])).toEqual([
    null,
  ])
})

test("PSRAM selects chips across source categories but excludes ordinary RAM and embedded PSRAM", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  try {
    database.exec(`CREATE TABLE categories (id INTEGER PRIMARY KEY, subcategory TEXT);
      CREATE TABLE components (lcsc INTEGER PRIMARY KEY, category_id INTEGER, description TEXT);`)
    const categories = [
      "PSRAM",
      "SRAM",
      "DRAM",
      "Global Sourcing Parts",
      "Microcontrollers",
      "WiFi Modules",
    ]
    await db
      .insertInto("categories")
      .values(categories.map((subcategory, i) => ({ id: i + 1, subcategory })))
      .execute()
    await db
      .insertInto("components")
      .values([
        { lcsc: 1, category_id: 1, description: "64Mbit" },
        { lcsc: 2, category_id: 2, description: "64Mbit PSRAM" },
        { lcsc: 3, category_id: 3, description: "USON-8 PSRAM ROHS" },
        { lcsc: 4, category_id: 4, description: "SOP-8 PSRAM ROHS" },
        { lcsc: 5, category_id: 2, description: "256Kbit SRAM ROHS" },
        { lcsc: 6, category_id: 3, description: "128Mbit SDRAM ROHS" },
        { lcsc: 7, category_id: 5, description: "8MB PSRAM MCU ROHS" },
        { lcsc: 8, category_id: 6, description: "8MB PSRAM WiFi module ROHS" },
      ])
      .execute()
    const candidates = await psramTableSpec
      .listCandidateComponents(db)
      .execute()
    expect(candidates.map((row) => row.lcsc)).toEqual([1, 2, 3, 4])
  } finally {
    await db.destroy()
  }
})

test("PSRAM schema and migration create query indexes idempotently", async () => {
  expect(
    psramTableSpec.indexes?.map((index) => index.columns.join(",")),
  ).toEqual(EXPECTED_INDEX_COLUMNS)

  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })
  try {
    await setupDerivedTables({ db, populate: false, tableNames: ["psram"] })
    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'psram' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    await db.destroy()
  }

  const migrationDatabase = new Database(":memory:")
  const migration = await Bun.file(
    new URL("../../cf-proxy/migrations/0010_psram.sql", import.meta.url),
  ).text()
  try {
    migrationDatabase.exec(migration)
    migrationDatabase.exec(migration)
    const indexes = migrationDatabase
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'psram' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    migrationDatabase.close()
  }
})
