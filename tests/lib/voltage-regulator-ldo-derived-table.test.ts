import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { ldoTableSpec } from "lib/db/derivedtables/ldo"
import { voltageRegulatorTableSpec } from "lib/db/derivedtables/voltage_regulator"
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

test("voltage_regulator and ldo select current LDO PMIC subcategory alongside legacy subcategories", async () => {
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
        {
          id: 1,
          category: "Power Management (PMIC)",
          subcategory:
            "Voltage Regulators - Linear, Low Drop Out (LDO) Regulators",
        },
        {
          id: 2,
          category: "Power Management ICs",
          subcategory: "Linear Voltage Regulators (LDO)",
        },
        {
          id: 3,
          category: "Power Management ICs",
          subcategory: "Low Dropout Regulators(LDO)",
        },
        {
          id: 4,
          category: "Power Management ICs",
          subcategory: "Dropout Regulators(LDO)",
        },
        {
          id: 5,
          category: "Power Management ICs",
          subcategory: "Linear Voltage Regulators",
        },
        {
          id: 6,
          category: "Power Management (PMIC)",
          subcategory: "DC-DC Converters",
        },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        { lcsc: 6186, category_id: 1 }, // AMS1117-3.3
        { lcsc: 5446, category_id: 1 }, // XC6206P332MR-G
        { lcsc: 81360, category_id: 2 }, // L78L33ABZ-AP
        { lcsc: 1001, category_id: 3 },
        { lcsc: 1002, category_id: 4 },
        { lcsc: 1003, category_id: 5 },
        { lcsc: 9999, category_id: 6 }, // DC-DC converter excluded
      ])
      .execute()

    const vrCandidates = await voltageRegulatorTableSpec
      .listCandidateComponents(db)
      .execute()
    const ldoCandidates = await ldoTableSpec
      .listCandidateComponents(db)
      .execute()

    expect(vrCandidates.map((c) => c.lcsc).sort((a, b) => a - b)).toEqual([
      1001, 1002, 1003, 5446, 6186, 81360,
    ])
    expect(ldoCandidates.map((c) => c.lcsc).sort((a, b) => a - b)).toEqual([
      1001, 1002, 1003, 5446, 6186, 81360,
    ])
  } finally {
    await db.destroy()
  }
})

test("voltage_regulator and ldo parse current JLCPCB attributes accurately", () => {
  const mappedRegulators = voltageRegulatorTableSpec.mapToTable([
    {
      lcsc: 6186,
      mfr: "AMS1117-3.3",
      description: "",
      stock: 1439007,
      basic: 1,
      preferred: 0,
      price: "1-49:0.2003,5000-:0.105",
      package: "SOT-223",
      subcategory: "Voltage Regulators - Linear, Low Drop Out (LDO) Regulators",
      extra: JSON.stringify({
        attributes: {
          "Operating Temperature": "-40℃~+125℃",
          Noise: "0.003%Vout",
          "Number of Outputs": "1",
          "Voltage Dropout": "1.1V@(800mA)",
          "Voltage - Supply": "15V",
          "Output Current": "1A",
          "Output Voltage": "3.3V",
          "standby current": "5mA",
          "Power Supply Rejection Ratio (PSRR)": "72dB@(120Hz)",
          "Output Type": "Fixed",
          "Output Configuration": "Positive",
        },
      }),
    } as any,
    {
      lcsc: 347376,
      mfr: "XC6206P332MR",
      description:
        "-25℃~+80℃@(Ta) 1 240mV@(50mA) 250mA 3.3V 40dB@(1kHz) 7uA 8V Fixed Positive SOT-23-3 Voltage Regulators - Linear, Low Drop Out (LDO) Regulators ROHS",
      stock: 1486908,
      basic: 0,
      preferred: 0,
      price: "1-9:0.05",
      package: "SOT-23-3",
      subcategory: "Voltage Regulators - Linear, Low Drop Out (LDO) Regulators",
      extra: JSON.stringify({
        attributes: {
          "Operating Temperature": "-25℃~+80℃@(Ta)",
          "Voltage Dropout": "240mV@(50mA)",
          "Output Current": "250mA",
          "Output Voltage": "3.3V",
          "Power Supply Rejection Ratio (PSRR)": "40dB@(1kHz)",
          "standby current": "7uA",
          "Voltage - Supply": "8V",
          "Output Type": "Fixed",
          "Output Configuration": "Positive",
        },
      }),
    } as any,
    {
      lcsc: 132629,
      mfr: "LD1117DT33TR",
      description:
        "0℃~+125℃@(Tj) 1 1.2V@(800mA) 100uVrms 15V 3.3V 5mA 75dB@(120Hz) 800mA Fixed Positive DPAK Linear Voltage Regulators (LDO) ROHS",
      stock: 19970,
      basic: 0,
      preferred: 0,
      price: "1-9:0.25",
      package: "TO-252-2",
      extra: JSON.stringify({
        attributes: {
          Noise: "100uVrms",
          "Operating Temperature": "0℃~+125℃@(Tj)",
          "Output Configuration": "Positive",
          "Output Current": "800mA",
          "Output Type": "Fixed",
          "Output Voltage": "3.3V",
          "Power Supply Rejection Ratio (PSRR)": "75dB@(120Hz)",
          "Voltage - Supply": "15V",
          "Voltage Dropout": "1.2V@(800mA)",
          "standby current": "5mA",
        },
      }),
    } as any,
    {
      lcsc: 2887324,
      mfr: "TPS7A0233PDBVR",
      description:
        "-40℃~+125℃@(Tj) 1 130uVrms 200mA 270mV@(200mA) 3.3V 50nA 55dB@(1kHz) 6V Fixed Positive SOT-23-5 Voltage Regulators - Linear, Low Drop Out (LDO) Regulators ROHS",
      stock: 5000,
      basic: 0,
      preferred: 0,
      price: "1-9:0.4",
      package: "SOT-23-5",
      extra: JSON.stringify({
        attributes: {
          "Operating Temperature": "-40℃~+125℃@(Tj)",
          Noise: "130uVrms",
          "Voltage Dropout": "270mV@(200mA)",
          "Output Current": "200mA",
          "Output Voltage": "3.3V",
          "Supply Current (Iq)": "50nA",
          "Power Supply Rejection Ratio (PSRR)": "55dB@(1kHz)",
          "Voltage - Supply": "2.0V~6.0V",
          "Output Type": "Fixed",
          "Output Configuration": "Positive",
        },
      }),
    } as any,
    {
      lcsc: 352863,
      mfr: "LM7905CT/NOPB",
      description: "TO-220 Linear Voltage Regulator ROHS",
      stock: 1000,
      basic: 0,
      preferred: 0,
      price: "1-9:0.5",
      package: "TO-220",
      subcategory: "Linear Voltage Regulators",
      extra: JSON.stringify({
        attributes: {
          "Operating Temperature": "0℃~+125℃@(Tj)",
          "Voltage Dropout": "1.1V@(1A)",
          "Output Current": "1.5A",
          "Output Voltage": "5V",
          "standby current": "1mA",
          "Voltage - Supply": "25V",
          "Output Type": "Fixed",
          "Output Configuration": "Negative",
        },
      }),
    } as any,
  ])

  expect(mappedRegulators[0]).toMatchObject({
    lcsc: 6186,
    mfr: "AMS1117-3.3",
    is_basic: true,
    output_type: "fixed",
    output_voltage_min: 3.3,
    output_voltage_max: 3.3,
    output_current_max: 1,
    dropout_voltage: 1.1,
    input_voltage_min: 4.4,
    input_voltage_max: 15,
    operating_temp_min: -40,
    operating_temp_max: 125,
    quiescent_current: 0.005,
    power_supply_rejection_db: 72,
    output_noise_uvrms: null,
    is_low_dropout: true,
    is_positive: true,
  })

  expect(mappedRegulators[1]).toMatchObject({
    lcsc: 347376,
    dropout_voltage: 0.24,
    input_voltage_min: 3.54,
    input_voltage_max: 8,
    quiescent_current: 0.000007,
    operating_temp_min: -25,
    operating_temp_max: 80,
    power_supply_rejection_db: 40,
    is_low_dropout: true,
    is_positive: true,
  })

  expect(mappedRegulators[2]).toMatchObject({
    lcsc: 132629,
    dropout_voltage: 1.2,
    input_voltage_min: 4.5,
    input_voltage_max: 15,
    quiescent_current: 0.005,
    output_noise_uvrms: 100,
    is_low_dropout: true,
  })

  expect(mappedRegulators[3]).toMatchObject({
    lcsc: 2887324,
    dropout_voltage: 0.27,
    input_voltage_min: 2,
    input_voltage_max: 6,
    quiescent_current: 5e-8,
    output_noise_uvrms: 130,
    is_low_dropout: true,
  })

  expect(mappedRegulators[4]).toMatchObject({
    lcsc: 352863,
    dropout_voltage: 1.1,
    output_current_max: 1.5,
    quiescent_current: 0.001,
    is_low_dropout: false,
    is_positive: false,
  })

  const mappedLdos = ldoTableSpec.mapToTable([
    {
      lcsc: 5446,
      mfr: "XC6206P332MR-G",
      description:
        "-40℃~+85℃@(Ta) 1 1uA 200mA 3.3V 6V Fixed Over Current Protection Positive SOT-23-3L Voltage Regulators - Linear, Low Drop Out (LDO) Regulators ROHS",
      stock: 500422,
      basic: 1,
      preferred: 0,
      price: "1-9:0.03",
      package: "SOT-23-3L",
      extra: null,
    } as any,
    {
      lcsc: 352863,
      mfr: "LM7905CT/NOPB",
      description: "TO-220 Linear Voltage Regulator ROHS",
      stock: 1000,
      basic: 0,
      preferred: 0,
      price: "1-9:0.5",
      package: "TO-220",
      subcategory: "Linear Voltage Regulators",
      extra: JSON.stringify({
        attributes: {
          "Voltage Dropout": "1.1V@(1A)",
          "Output Configuration": "Negative",
        },
      }),
    } as any,
  ])

  expect(mappedLdos[0]).toMatchObject({
    lcsc: 5446,
    output_type: "fixed",
    operating_temp_min: -40,
    operating_temp_max: 85,
    is_positive: true,
  })
  expect(mappedLdos[1]).toBeNull()
})

test("buildDerivedSyncDatabase populates voltage_regulator and ldo from current JLCPCB LDO category", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "jlcsearch-ldo-derived-"))
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
          (6186, unixepoch(), 1, 1, 'Power Management (PMIC)', 'Voltage Regulators - Linear, Low Drop Out (LDO) Regulators', 'AMS1117-3.3', 'SOT-223', 4, 'Advanced Monolithic Systems', 'base', 0, unixepoch(), 'LDO 3.3V 1A', '', 1439007, '1-49:0.2003', '{"Operating Temperature":"-40℃~+125℃","Output Type":"Fixed","Output Voltage":"3.3V","Output Current":"1A","Voltage Dropout":"1.1V@(800mA)","Voltage - Supply":"15V","standby current":"5mA","Output Configuration":"Positive","Noise":"0.003%Vout"}'),
          (347376, unixepoch(), 1, 1, 'Power Management (PMIC)', 'Voltage Regulators - Linear, Low Drop Out (LDO) Regulators', 'XC6206P332MR', 'SOT-23-3', 3, 'Torex', 'expand', 0, unixepoch(), 'LDO 3.3V 250mA', '', 1486908, '1-9:0.05', '{"Operating Temperature":"-25℃~+80℃@(Ta)","Output Type":"Fixed","Output Voltage":"3.3V","Output Current":"250mA","Voltage Dropout":"240mV@(50mA)","Voltage - Supply":"8V","standby current":"7uA","Output Configuration":"Positive"}'),
          (352863, unixepoch(), 1, 1, 'Power Management ICs', 'Linear Voltage Regulators', 'LM7905CT/NOPB', 'TO-220', 3, 'TI', 'expand', 0, unixepoch(), 'Fixed Negative Linear Voltage Regulator', '', 1000, '1-9:0.5', '{"Operating Temperature":"0℃~+125℃@(Tj)","Output Type":"Fixed","Output Voltage":"5V","Output Current":"1.5A","Voltage Dropout":"1.1V@(1A)","Voltage - Supply":"25V","standby current":"1mA","Output Configuration":"Negative"}')`,
      )
      .run()
  } finally {
    source.close()
  }

  await buildDerivedSyncDatabase({
    sourcePath,
    outputPath,
    tableNames: ["voltage_regulator", "ldo"],
    logger: () => {},
  })

  const derived = new Database(outputPath, { readonly: true })
  try {
    const vrRows = derived
      .query(
        "SELECT lcsc, mfr, dropout_voltage, input_voltage_min, input_voltage_max, quiescent_current, output_noise_uvrms, is_low_dropout, is_positive FROM voltage_regulator ORDER BY lcsc",
      )
      .all()
    expect(vrRows).toEqual([
      {
        lcsc: 6186,
        mfr: "AMS1117-3.3",
        dropout_voltage: 1.1,
        input_voltage_min: 4.4,
        input_voltage_max: 15,
        quiescent_current: 0.005,
        output_noise_uvrms: null,
        is_low_dropout: 1,
        is_positive: 1,
      },
      {
        lcsc: 347376,
        mfr: "XC6206P332MR",
        dropout_voltage: 0.24,
        input_voltage_min: 3.54,
        input_voltage_max: 8,
        quiescent_current: 0.000007,
        output_noise_uvrms: null,
        is_low_dropout: 1,
        is_positive: 1,
      },
      {
        lcsc: 352863,
        mfr: "LM7905CT/NOPB",
        dropout_voltage: 1.1,
        input_voltage_min: 6.1,
        input_voltage_max: 25,
        quiescent_current: 0.001,
        output_noise_uvrms: null,
        is_low_dropout: 0,
        is_positive: 0,
      },
    ])

    const ldoRows = derived
      .query(
        "SELECT lcsc, mfr, dropout_voltage, input_voltage_max, quiescent_current FROM ldo ORDER BY lcsc",
      )
      .all()
    expect(ldoRows).toEqual([
      {
        lcsc: 6186,
        mfr: "AMS1117-3.3",
        dropout_voltage: 1.1,
        input_voltage_max: 15,
        quiescent_current: 0.005,
      },
      {
        lcsc: 347376,
        mfr: "XC6206P332MR",
        dropout_voltage: 0.24,
        input_voltage_max: 8,
        quiescent_current: 0.000007,
      },
    ])
  } finally {
    derived.close()
  }
})
