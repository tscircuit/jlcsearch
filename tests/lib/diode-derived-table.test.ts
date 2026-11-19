import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { diodeTableSpec } from "lib/db/derivedtables/diode"
import { buildDerivedSyncDatabase } from "../../scripts/build-derived-sync-db"

const tempDirectories: string[] = []

afterEach(async () => {
  Bun.gc(true)
  await Promise.all(
    tempDirectories.splice(0).map(async (directory) => {
      try {
        await rm(directory, { recursive: true, force: true })
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("code" in error) ||
          error.code !== "EBUSY"
        ) {
          throw error
        }
      }
    }),
  )
})

test("diode table selects current JLCPCB Schottky, Switching, and Fast Recovery subcategories", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (column) => column.primaryKey())
      .addColumn("category", "text", (column) => column.notNull())
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
        { id: 1, category: "Diodes", subcategory: "Schottky Diodes" },
        { id: 2, category: "Diodes", subcategory: "Switching Diodes" },
        {
          id: 3,
          category: "Diodes",
          subcategory: "Diodes - General Purpose",
        },
        {
          id: 4,
          category: "Diodes",
          subcategory: "Schottky Barrier Diodes (SBD)",
        },
        {
          id: 5,
          category: "Diodes",
          subcategory: "Diodes - Fast Recovery Rectifiers",
        },
        {
          id: 6,
          category: "Diodes",
          subcategory: "Zener Diodes",
        },
        {
          id: 7,
          category: "Transistors/Thyristors",
          subcategory: "MOSFETs",
        },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        { lcsc: 2927280, category_id: 1 }, // 1N5819WS S4
        { lcsc: 7420319, category_id: 2 }, // 1N4148WS
        { lcsc: 2891324, category_id: 3 }, // A7
        { lcsc: 85269, category_id: 4 }, // SK34A-LTP
        { lcsc: 1001, category_id: 5 },
        { lcsc: 22375293, category_id: 6 }, // BZT52C36S
        { lcsc: 8545, category_id: 7 }, // 2N7002 MOSFET excluded
      ])
      .execute()

    const candidates = await diodeTableSpec
      .listCandidateComponents(db)
      .execute()

    expect(candidates.map((c) => c.lcsc).sort((a, b) => a - b)).toEqual([
      1001, 85269, 2891324, 2927280, 7420319, 22375293,
    ])
  } finally {
    await db.destroy()
  }
})

test("diode table parses current JLCPCB attribute keys, mV forward voltages, and watt power ratings", () => {
  const mapped = diodeTableSpec.mapToTable([
    {
      lcsc: 2891324,
      mfr: "A7",
      description:
        "1.1V@1A 1A 1kV 25A 5uA@1kV Independent SOD-123FL Diodes - General Purpose ROHS",
      stock: 3537874,
      basic: 0,
      preferred: 0,
      price: "1-9:0.01",
      package: "SOD-123FL",
      subcategory: "Diodes - General Purpose",
      extra: JSON.stringify({
        attributes: {
          "Current - Rectified": "1A",
          "Diode Configuration": "Independent Type",
          "Operating Junction Temperature Range": "-65℃~+150℃",
          "Reverse Leakage Current (Ir)": "5uA@1kV",
          "Voltage - DC Reverse(Vr)": "1kV",
          "Voltage - Forward(Vf@If)": "1.1V@1A",
        },
      }),
    } as any,
    {
      lcsc: 3014005,
      mfr: "SS14",
      description: "",
      stock: 38841,
      basic: 0,
      preferred: 0,
      price: "1-9:0.02",
      package: "SMA(DO-214AC)",
      subcategory: "Schottky Diodes",
      extra: JSON.stringify({
        attributes: {
          "Current - Rectified": "1A",
          "Diode Configuration": "Independent",
          "Operating Junction Temperature Range": "-65℃~+150℃@(Tj)",
          "Reverse Leakage Current (Ir)": "200uA@40V",
          "Voltage - DC Reverse(Vr)": "40V",
          "Voltage - Forward(Vf@If)": "550mV@1A",
          "Pd - Power Dissipation": "500mW",
        },
      }),
    } as any,
    {
      lcsc: 7420319,
      mfr: "1N4148WS",
      description: "",
      stock: 2253018,
      basic: 0,
      preferred: 0,
      price: "1-9:0.008",
      package: "SOD-323",
      subcategory: "Switching Diodes",
      extra: JSON.stringify({
        attributes: {
          "Current - Rectified": "150mA",
          "Diode Configuration": "Independent",
          "Operating Junction Temperature Range": "-55℃~+150℃",
          "Pd - Power Dissipation": "200mW",
          "Reverse Leakage Current (Ir)": "1uA@75V",
          "Reverse Recovery Time (trr)": "4ns",
          "Voltage - DC Reverse(Vr)": "100V",
          "Voltage - Forward(Vf@If)": "1.25V@150mA",
        },
      }),
    } as any,
    {
      lcsc: 22375293,
      mfr: "BZT52C36S",
      description:
        "-55℃~+150℃ 1 Independent 100nA 200mW 36V SOD-323 Zener Diodes ROHS",
      stock: 767888,
      basic: 0,
      preferred: 0,
      price: "1-9:0.01",
      package: "SOD-323",
      subcategory: "Zener Diodes",
      extra: JSON.stringify({
        attributes: {
          "Diode Configuration": "1 Independent",
          "Operating Junction Temperature Range": "-55℃~+150℃",
          "Pd - Power Dissipation": "200mW",
          "Reverse Leakage Current (Ir)": "100nA",
          "Zener Voltage(Nom)": "36V",
        },
      }),
    } as any,
    {
      lcsc: 5186035,
      mfr: "MMBZ6V2A",
      description:
        "2.76A 24W 3V 500nA 6.2V 8.7V TVS Unidirectional SOT-23 ESD and Surge Protection (TVS/ESD) ROHS",
      stock: 10000,
      basic: 0,
      preferred: 0,
      price: "1-9:0.03",
      package: "SOT-23",
      extra: JSON.stringify({
        attributes: {
          "Peak Pulse Power Dissipation (Ppp)": "24W",
          "Reverse Leakage Current (Ir)": "500nA",
          "Reverse Stand-Off Voltage (Vrwm)": "3V",
          Type: "TVS",
        },
      }),
    } as any,
  ])

  expect(mapped[0]).toMatchObject({
    lcsc: 2891324,
    diode_type: "general_purpose",
    forward_voltage: 1.1,
    reverse_voltage: 1000,
    forward_current: 1,
    reverse_leakage_current: 5,
    operating_temp_min: -65,
    operating_temp_max: 150,
    configuration: "Independent Type",
  })

  expect(mapped[1]).toMatchObject({
    lcsc: 3014005,
    diode_type: "schottky_barrier",
    is_schottky: true,
    forward_voltage: 0.55,
    reverse_voltage: 40,
    forward_current: 1,
    power_dissipation_watts: 0.5,
    operating_temp_min: -65,
    operating_temp_max: 150,
  })

  expect(mapped[2]).toMatchObject({
    lcsc: 7420319,
    diode_type: "switching",
    is_schottky: false,
    forward_voltage: 1.25,
    reverse_voltage: 100,
    forward_current: 0.15,
    recovery_time_ns: 4,
    power_dissipation_watts: 0.2,
    operating_temp_min: -55,
    operating_temp_max: 150,
  })

  expect(mapped[3]).toMatchObject({
    lcsc: 22375293,
    diode_type: "zener",
    is_zener: true,
    power_dissipation_watts: 0.2,
    operating_temp_min: -55,
    operating_temp_max: 150,
  })

  expect(mapped[4]).toMatchObject({
    lcsc: 5186035,
    diode_type: "tvs",
    is_tvs: true,
    reverse_voltage: 3,
    power_dissipation_watts: 24,
  })
})

test("buildDerivedSyncDatabase populates diode table from current JLCPCB diode subcategories", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "jlcsearch-diode-derived-"),
  )
  tempDirectories.push(directory)
  const sourcePath = path.join(directory, "source.sqlite3")
  const outputPath = path.join(directory, "derived.sqlite3")
  const source = new Database(sourcePath, { create: true })

  try {
    source.exec(`
      CREATE TABLE jlc_components (
        lcsc INTEGER PRIMARY KEY,
        fetched_at INTEGER NOT NULL,
        present INTEGER NOT NULL,
        sync_seen INTEGER NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        mfr TEXT NOT NULL,
        package TEXT NOT NULL,
        joints INTEGER NOT NULL,
        manufacturer TEXT NOT NULL,
        library_type TEXT NOT NULL,
        preferred INTEGER NOT NULL,
        last_on_stock INTEGER NOT NULL,
        description TEXT NOT NULL,
        datasheet TEXT NOT NULL,
        stock INTEGER NOT NULL,
        price TEXT NOT NULL,
        attributes TEXT NOT NULL
      );

      CREATE TABLE lcsc_components (
        lcsc INTEGER PRIMARY KEY,
        fetched_at INTEGER NOT NULL,
        manufacturer TEXT NOT NULL,
        attributes TEXT NOT NULL,
        image TEXT,
        url_slug TEXT
      );
    `)

    source
      .query(
        `INSERT INTO jlc_components (
          lcsc, fetched_at, present, sync_seen, category, subcategory, mfr,
          package, joints, manufacturer, library_type, preferred, last_on_stock,
          description, datasheet, stock, price, attributes
        ) VALUES
          (2891324, unixepoch(), 1, 1, 'Diodes', 'Diodes - General Purpose', 'A7', 'SOD-123FL', 2, 'born', 'expand', 0, unixepoch(), '1.1V@1A 1A 1kV SOD-123FL Diodes - General Purpose ROHS', '', 3537874, '1-9:0.0072', '{"Current - Rectified":"1A","Voltage - DC Reverse(Vr)":"1kV","Voltage - Forward(Vf@If)":"1.1V@1A","Operating Junction Temperature Range":"-65℃~+150℃"}'),
          (3014005, unixepoch(), 1, 1, 'Diodes', 'Schottky Diodes', 'SS14', 'SMA(DO-214AC)', 2, 'XSD', 'expand', 0, unixepoch(), '', '', 38841, '1-9:0.02', '{"Current - Rectified":"1A","Voltage - DC Reverse(Vr)":"40V","Voltage - Forward(Vf@If)":"550mV@1A","Pd - Power Dissipation":"500mW","Operating Junction Temperature Range":"-65℃~+150℃@(Tj)"}'),
          (7420319, unixepoch(), 1, 1, 'Diodes', 'Switching Diodes', '1N4148WS', 'SOD-323', 2, 'born', 'expand', 0, unixepoch(), '', '', 2253018, '1-9:0.008', '{"Current - Rectified":"150mA","Voltage - DC Reverse(Vr)":"100V","Voltage - Forward(Vf@If)":"1.25V@150mA","Reverse Recovery Time (trr)":"4ns","Pd - Power Dissipation":"200mW","Operating Junction Temperature Range":"-55℃~+150℃"}')`,
      )
      .run()
  } finally {
    source.close()
  }

  await buildDerivedSyncDatabase({
    sourcePath,
    outputPath,
    tableNames: ["diode"],
    logger: () => {},
  })

  const derived = new Database(outputPath, { readonly: true })
  try {
    const rows = derived
      .query(
        "SELECT lcsc, mfr, diode_type, is_schottky, forward_voltage, reverse_voltage, forward_current, recovery_time_ns, power_dissipation_watts, operating_temp_min, operating_temp_max FROM diode ORDER BY lcsc",
      )
      .all()
    expect(rows).toEqual([
      {
        lcsc: 2891324,
        mfr: "A7",
        diode_type: "general_purpose",
        is_schottky: 0,
        forward_voltage: 1.1,
        reverse_voltage: 1000,
        forward_current: 1,
        recovery_time_ns: null,
        power_dissipation_watts: null,
        operating_temp_min: -65,
        operating_temp_max: 150,
      },
      {
        lcsc: 3014005,
        mfr: "SS14",
        diode_type: "schottky_barrier",
        is_schottky: 1,
        forward_voltage: 0.55,
        reverse_voltage: 40,
        forward_current: 1,
        recovery_time_ns: null,
        power_dissipation_watts: 0.5,
        operating_temp_min: -65,
        operating_temp_max: 150,
      },
      {
        lcsc: 7420319,
        mfr: "1N4148WS",
        diode_type: "switching",
        is_schottky: 0,
        forward_voltage: 1.25,
        reverse_voltage: 100,
        forward_current: 0.15,
        recovery_time_ns: 4,
        power_dissipation_watts: 0.2,
        operating_temp_min: -55,
        operating_temp_max: 150,
      },
    ])
  } finally {
    derived.close()
  }
})
