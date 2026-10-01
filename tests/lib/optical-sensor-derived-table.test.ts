import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { opticalSensorTableSpec as spec } from "lib/db/derivedtables/optical-sensor"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const component = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 1,
    mfr: "PMW3360DM-T2QU",
    description: "",
    package: "DIP-16",
    stock: 100,
    price: JSON.stringify([{ qFrom: 1, price: 2.5 }]),
    basic: 0,
    preferred: 1,
    extra: null,
    ...overrides,
  }) as any

test("recognizes mouse, trackball and optical flow sensors without optional metadata", () => {
  for (const mfr of [
    "PMW3360DM-T2QU",
    "PAW3220LU-TJDU",
    "PAW3395DM-T6QU",
    "PMW3901MB-TXQT",
    "ADNS-9800",
    "ADNS-9500",
    "PAT9125EL-TKIT",
    "PAA5100JE-Q",
  ]) {
    for (const extra of [null, "{invalid", "null", "{}"]) {
      expect(spec.mapToTable([component({ mfr, extra })])[0]).toMatchObject({
        mfr,
        sensor_type: "Optical Motion",
        package: "DIP-16",
        stock: 100,
        price1: 2.5,
        in_stock: true,
        is_basic: false,
        is_preferred: true,
      })
    }
  }
})

test("accepts descriptions and dedicated categories while excluding unrelated parts and lenses", () => {
  const fixtures = [
    component({
      mfr: "OTHER",
      description: "Wireless optical mouse sensor SPI",
    }),
    component({ mfr: "OTHER", description: "Trackball mouse sensor" }),
    component({ mfr: "OTHER", description: "Optical Gaming Navigation Chip" }),
    component({ mfr: "OTHER", source_subcategory: "Optical Motion Sensors" }),
    component({
      mfr: "BH1750FVI",
      source_subcategory: "Ambient Light Sensors",
    }),
    component({
      mfr: "TCRT5000",
      source_subcategory: "Reflective Optical Interrupters",
    }),
    component({ mfr: "OTHER", description: "Optical sensor" }),
    component({ description: "Optical mouse sensor with integrated lens" }),
    component({ mfr: "ADNS-6190", description: "" }),
    component({ mfr: "PMW33600" }),
    component({ mfr: "PAW33950" }),
    component({ mfr: "nRF52840", description: "Wireless mouse controller" }),
    component({ mfr: "ADNS-6190", description: "Optical mouse sensor lens" }),
    component({
      mfr: "LDC1612",
      source_subcategory: "Specialized Sensors",
      description: "Inductance-to-Digital Converter",
    }),
    component({
      mfr: "VCNL",
      source_subcategory: "Proximity Sensors",
      description: "Capacitive I2C proximity sensor",
    }),
  ]
  expect(spec.mapToTable(fixtures).map(Boolean)).toEqual([
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ])
  expect(spec.mapToTable([component({ stock: 0 })])[0]?.in_stock).toBe(false)
  const attributes = { Interface: "SPI" }
  expect(
    spec.mapToTable([component({ extra: JSON.stringify({ attributes }) })])[0]
      ?.attributes,
  ).toEqual(attributes)
})

test("populates sensors across upstream categories and matches the D1 migration schema", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  const migrated = new Database(":memory:")
  try {
    database.exec(`CREATE TABLE categories (id INTEGER PRIMARY KEY, category TEXT, subcategory TEXT);
      CREATE TABLE components (lcsc INTEGER PRIMARY KEY, category_id INTEGER, mfr TEXT, description TEXT, package TEXT, stock INTEGER, price TEXT, basic INTEGER, preferred INTEGER, extra TEXT);`)
    await db
      .insertInto("categories")
      .values([
        { id: 1, subcategory: "Specialized Sensors" },
        { id: 2, subcategory: "Ambient Light Sensors" },
        { id: 3, subcategory: "Optical Motion Sensors" },
      ])
      .execute()
    await db
      .insertInto("components")
      .values([
        component({ category_id: 1 }),
        component({ lcsc: 2, category_id: 2, mfr: "PMW3901MB-TXQT" }),
        component({ lcsc: 3, category_id: 3, mfr: "OTHER" }),
        component({ lcsc: 4, category_id: 2, mfr: "BH1750FVI" }),
        component({ lcsc: 5, category_id: 1, mfr: "LDC1612" }),
        component({ lcsc: 6, category_id: null, mfr: "PAW3220LU-TJDU" }),
        component({
          lcsc: 7,
          category_id: null,
          mfr: "OTHER",
          description: "Wireless optical mouse sensor",
        }),
        component({ lcsc: 8, category_id: 1, mfr: "PMW33600" }),
      ])
      .execute()
    await setupDerivedTables({ db, tableNames: ["optical_sensor"] })
    expect(
      (
        await db
          .selectFrom("optical_sensor")
          .select("lcsc")
          .orderBy("lcsc")
          .execute()
      ).map((c) => c.lcsc),
    ).toEqual([1, 2, 3, 4, 6, 7])
    const migration = await Bun.file(
      new URL(
        "../../cf-proxy/migrations/0016_optical_sensor.sql",
        import.meta.url,
      ),
    ).text()
    migrated.exec(migration)
    migrated.exec(migration)
    const columns = (sqlite: Database) =>
      sqlite
        .query("PRAGMA table_info(optical_sensor)")
        .all()
        .map((column: any) => ({ ...column, type: column.type.toUpperCase() }))
    expect(columns(migrated)).toEqual(columns(database))
    expect(
      migrated
        .query(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='optical_sensor'",
        )
        .all(),
    ).toHaveLength(5)
  } finally {
    migrated.close()
    await db.destroy()
  }
})

test("covers every optical sensing type without adding emitters or capacitive sensors", () => {
  for (const subcategory of [
    "Photodiodes",
    "Phototransistors",
    "Photoresistors",
    "Image Sensors",
    "Fiber Optic / Laser Sensors",
    "Photoelectric sensor",
    "Infrared Remote Receiver (IRM)",
    "Color Sensors",
    "UV Sensors",
    "Infrared Sensors",
    "Optical Distance Sensors",
    "Optical Position Sensors",
    "Optical Sensors - Photodetectors",
  ]) {
    expect(
      spec.mapToTable([
        component({ mfr: "OTHER", source_subcategory: subcategory }),
      ])[0]?.sensor_type,
    ).toBe(subcategory)
  }
  for (const [mfr, description, attributes] of [
    ["ADNS-3080", "", {}],
    ["MLX90614ESF-BAA-000-TU", "", {}],
    ["PAJ7620U2", "", {}],
    ["MAX30102EFD+T", "", {}],
    ["OTHER", "PIR motion sensor", {}],
    ["OTHER", "Optical rotary encoder", {}],
    ["VL53L0X", "", {}],
    ["GP2Y1014AU0F", "", {}],
    ["OTHER", "Infrared proximity sensor", {}],
    ["OTHER", "", { "Sensor Type": "Optical" }],
    ["OTHER", "", { Type: "Color" }],
    ["OTHER", "", { "Detection Method": "Infrared" }],
  ] as Array<[string, string, Record<string, string>]>) {
    expect(
      spec.mapToTable([
        component({
          mfr,
          description,
          source_subcategory: "Specialized Sensors",
          extra: JSON.stringify({ attributes }),
        }),
      ])[0],
    ).not.toBeNull()
  }
  expect(
    spec.mapToTable([
      component({
        mfr: "OTHER",
        source_category: "Optical Sensors",
        source_subcategory: "Future Optical Type",
      }),
    ])[0]?.sensor_type,
  ).toBe("Future Optical Type")
  for (const description of [
    "Infrared LED emitter",
    "Capacitive proximity sensor",
    "Optical fiber transceiver",
    "MOSFET with optical interface",
    "Ultrasonic time-of-flight sensor",
  ]) {
    expect(
      spec.mapToTable([component({ mfr: "OTHER", description })])[0],
    ).toBeNull()
  }
})
