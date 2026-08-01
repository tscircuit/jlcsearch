import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { photoDiodeTableSpec } from "lib/db/derivedtables/photo-diode"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 161211,
    mfr: "PD15-22B/TR8",
    description:
      "32V 940nm 730nm~1100nm 10nA SMD-4P,2.7x3.2mm Photodiodes ROHS",
    stock: 47803,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.080724638 }]),
    package: "SMD-4P,2.7x3.2mm",
    extra: JSON.stringify({
      title: "Everlight Elec PD15-22B/TR8",
      attributes: {
        "Reception Angle": "60°",
        "Operating Temperature": "-40℃~+85℃",
        "Spectral Range": "730nm~1100nm",
        "DC Reverse Voltage": "32V",
        "Current Dark": "10nA",
        "Peak  Wavelength": "940nm",
      },
    }),
    ...overrides,
  }) as any

const EXPECTED_INDEX_COLUMNS = [
  "stock",
  "package,stock",
  "peak_wavelength_nm,stock",
  "reverse_voltage,stock",
  "dark_current_a,stock",
  "is_basic,stock",
  "is_preferred,stock",
]

test("photo diode table maps optical and electrical attributes", () => {
  const [photoDiode] = photoDiodeTableSpec.mapToTable([makeComponent()])

  expect(photoDiode).toMatchObject({
    lcsc: 161211,
    mfr: "PD15-22B/TR8",
    package: "SMD-4P,2.7x3.2mm",
    peak_wavelength_nm: 940,
    spectral_range_min_nm: 730,
    spectral_range_max_nm: 1100,
    reverse_voltage: 32,
    dark_current_a: 10e-9,
    reception_angle_deg: 60,
    operating_temp_min: -40,
    operating_temp_max: 85,
    is_preferred: true,
    price1: 0.080724638,
  })
})

test("photo diode table falls back to description data", () => {
  const [photoDiode] = photoDiodeTableSpec.mapToTable([
    makeComponent({
      extra: null,
      description: "32V 940nm 730nm~1100nm 10nA Plugin Photodiodes ROHS",
      package: "Plugin",
    }),
  ])

  expect(photoDiode).toMatchObject({
    package: "Plugin",
    peak_wavelength_nm: 940,
    spectral_range_min_nm: 730,
    spectral_range_max_nm: 1100,
    reverse_voltage: 32,
    dark_current_a: 10e-9,
  })
})

test("photo diode table selects the Photodiodes subcategory", async () => {
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
        { id: 1, subcategory: "Photodiodes" },
        { id: 2, subcategory: "Phototransistors" },
        { id: 3, subcategory: "Laser Diodes" },
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

    const candidates = await photoDiodeTableSpec
      .listCandidateComponents(db)
      .execute()

    expect(candidates.map((candidate) => candidate.lcsc)).toEqual([1])
  } finally {
    await db.destroy()
  }
})

test("photo diode schema and migration create query indexes idempotently", async () => {
  expect(
    photoDiodeTableSpec.indexes?.map((index) => index.columns.join(",")),
  ).toEqual(EXPECTED_INDEX_COLUMNS)

  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await setupDerivedTables({ db, populate: false })

    const table = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'photo_diode'",
      )
      .get()
    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'photo_diode' AND name NOT LIKE 'sqlite_%'",
      )
      .all()

    expect(table).not.toBeNull()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    await db.destroy()
  }

  const migrationDatabase = new Database(":memory:")
  const migrationPath = new URL(
    "../../cf-proxy/migrations/0003_photo_diode.sql",
    import.meta.url,
  )
  const migration = await Bun.file(migrationPath).text()

  try {
    migrationDatabase.exec(migration)
    migrationDatabase.exec(migration)

    const table = migrationDatabase
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'photo_diode'",
      )
      .get()
    const indexes = migrationDatabase
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'photo_diode' AND name NOT LIKE 'sqlite_%'",
      )
      .all()

    expect(table).not.toBeNull()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    migrationDatabase.close()
  }
})
