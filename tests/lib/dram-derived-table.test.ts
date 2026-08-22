import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { dramTableSpec } from "lib/db/derivedtables/dram"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 500275,
    mfr: "K4B4G1646E-BYMA",
    description:
      "-40℃~+95℃ 1.28V~1.45V 4Gbit 933MHz DDR3L SDRAM FBGA-96 DDR SDRAM ROHS",
    stock: 5739,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 16.8479 }]),
    package: "FBGA-96(7.5x13.3)",
    subcategory: "DDR SDRAM",
    extra: JSON.stringify({
      package: "FBGA-96(7.5x13.3)",
      attributes: {},
    }),
    ...overrides,
  }) as any

const EXPECTED_INDEX_COLUMNS = [
  "stock",
  "package,stock",
  "memory_type,stock",
  "memory_size_mbit,stock",
  "clock_frequency_mhz,stock",
  "is_basic,stock",
  "is_preferred,stock",
]

test("DRAM table maps DDR attributes embedded in descriptions", () => {
  const [dram] = dramTableSpec.mapToTable([makeComponent()])

  expect(dram).toMatchObject({
    lcsc: 500275,
    mfr: "K4B4G1646E-BYMA",
    memory_type: "DDR3L",
    memory_size_mbit: 4096,
    clock_frequency_mhz: 933,
    supply_voltage_min: 1.28,
    supply_voltage_max: 1.45,
    operating_temp_min: -40,
    operating_temp_max: 95,
    is_preferred: true,
    price1: 16.8479,
  })
})

test("DRAM table maps plain SDRAM attributes", () => {
  const [dram] = dramTableSpec.mapToTable([
    makeComponent({
      lcsc: 62379,
      subcategory: "SDRAM",
      description: "128Mbit 166MHz 3V~3.6V SDRAM ROHS",
      extra: JSON.stringify({
        attributes: {
          "Operating Temperature": "0℃~+70℃",
          "Memory Size": "128Mbit",
          "Clock Frequency (fc)": "166MHz",
        },
      }),
    }),
  ])

  expect(dram).toMatchObject({
    memory_type: "SDRAM",
    memory_size_mbit: 128,
    clock_frequency_mhz: 166,
    operating_temp_min: 0,
    operating_temp_max: 70,
  })
})

test("DRAM table selects DRAM IC categories but not memory connectors", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (column) => column.primaryKey())
      .addColumn("subcategory", "text", (column) => column.notNull())
      .execute()
    await db.schema
      .createTable("components")
      .addColumn("lcsc", "integer", (column) => column.primaryKey())
      .addColumn("category_id", "integer", (column) => column.notNull())
      .execute()
    await db
      .insertInto("categories")
      .values([
        { id: 1, subcategory: "DDR SDRAM" },
        { id: 2, subcategory: "SDRAM" },
        { id: 3, subcategory: "Memory Connector (DDR)" },
      ])
      .execute()
    await db
      .insertInto("components")
      .values([
        { lcsc: 1, category_id: 1 },
        { lcsc: 2, category_id: 2 },
        { lcsc: 3, category_id: 3 },
      ])
      .execute()

    const candidates = await dramTableSpec.listCandidateComponents(db).execute()
    expect(candidates.map((candidate) => candidate.lcsc)).toEqual([1, 2])
  } finally {
    await db.destroy()
  }
})

test("DRAM schema and migration create query indexes idempotently", async () => {
  expect(
    dramTableSpec.indexes?.map((index) => index.columns.join(",")),
  ).toEqual(EXPECTED_INDEX_COLUMNS)

  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })
  try {
    await setupDerivedTables({ db, populate: false, tableNames: ["dram"] })
    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'dram' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    await db.destroy()
  }

  const migrationDatabase = new Database(":memory:")
  const migration = await Bun.file(
    new URL("../../cf-proxy/migrations/0007_dram.sql", import.meta.url),
  ).text()
  try {
    migrationDatabase.exec(migration)
    migrationDatabase.exec(migration)
    const indexes = migrationDatabase
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'dram' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    migrationDatabase.close()
  }
})
