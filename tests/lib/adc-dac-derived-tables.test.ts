import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { adcTableSpec } from "lib/db/derivedtables/adc"
import { dacTableSpec } from "lib/db/derivedtables/dac"
import { buildDerivedSyncDatabase } from "../../scripts/build-derived-sync-db"

test("adc and dac tables select both plural and Data Acquisition singular subcategories", async () => {
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
          category: "Analog ICs",
          subcategory: "Analog To Digital Converters (ADCs)",
        },
        {
          id: 2,
          category: "Data Acquisition",
          subcategory: "Analog To Digital Converters (ADC)",
        },
        {
          id: 3,
          category: "Data Acquisition",
          subcategory: "Analog to Digital Converters (ADC)",
        },
        {
          id: 4,
          category: "ADC/DAC/Data Conversion",
          subcategory: "Digital To Analog Converters (DACs)",
        },
        {
          id: 5,
          category: "Data Acquisition",
          subcategory: "Digital To Analog Converters (DAC)",
        },
        {
          id: 6,
          category: "Data Acquisition",
          subcategory: "Digital to Analog Converters (DAC)",
        },
        {
          id: 7,
          category: "Data Acquisition",
          subcategory: "Digital Potentiometers",
        },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        { lcsc: 37593, category_id: 1 },
        { lcsc: 6705483, category_id: 2 },
        { lcsc: 609743, category_id: 3 },
        { lcsc: 61423, category_id: 4 },
        { lcsc: 478093, category_id: 5 },
        { lcsc: 486043, category_id: 6 },
        { lcsc: 999999, category_id: 7 },
      ])
      .execute()

    const adcCandidates = await adcTableSpec
      .listCandidateComponents(db)
      .execute()
    const dacCandidates = await dacTableSpec
      .listCandidateComponents(db)
      .execute()

    expect(adcCandidates.map((row) => row.lcsc).sort((a, b) => a - b)).toEqual([
      37593, 609743, 6705483,
    ])
    expect(dacCandidates.map((row) => row.lcsc).sort((a, b) => a - b)).toEqual([
      61423, 478093, 486043,
    ])
  } finally {
    await db.destroy()
  }
})

test("adc table maps current JLCPCB attributes and description fallbacks", () => {
  const mapped = adcTableSpec.mapToTable([
    {
      lcsc: 2651328,
      mfr: "ADS1115IRUGR",
      description:
        "-40℃~+125℃ 16 1LSB 1MHz 2 2V~5.5V 2uA 6.144V 860Hz X2QFN-10 Analog To Digital Converters (ADC) ROHS",
      stock: 5022,
      basic: 0,
      preferred: 1,
      price: JSON.stringify([{ qFrom: 1, qTo: null, price: 1.42 }]),
      package: "X2QFN-10",
      extra: JSON.stringify({
        attributes: {
          "Resolution (Bits)": "16",
          "Sampling Rate": "8Hz, 16Hz, 32Hz, 64Hz, 128Hz, 250Hz, 475Hz, 860Hz",
          "Voltage - Supply": "2V~5.5V",
          "Number of Channels": "4",
          "Interface Type": "I2C",
          "differential input": "Yes",
          "Operating Temperature": "-40℃~+125℃",
        },
      }),
    } as any,
    {
      lcsc: 626764,
      mfr: "MCP3208T-CI/SL",
      description: "12-Bit 100kSPS 2.7V~5.5V -40℃~+85℃ SPI SOIC-16",
      stock: 743,
      basic: 0,
      preferred: 0,
      price: "1-9:1.85",
      package: "SOIC-16",
      extra: null,
    } as any,
    {
      lcsc: 100200,
      mfr: "PCM1808PWR",
      description: "Audio Stereo ADC",
      stock: 1500,
      basic: 0,
      preferred: 0,
      price: "1-9:0.75",
      package: "TSSOP-14",
      extra: JSON.stringify({
        attributes: {
          "Resolution(Bits)": "24",
          "Sampling Rate": "96kHz",
          "Voltage - Supply": "2.7V~3.6V, 4.5V~5.5V",
          "number of channels": "2",
          Interface: "I2S, Serial port",
          "Operating Temperature": "-20℃~+85℃",
        },
      }),
    } as any,
  ])

  expect(mapped[0]).toMatchObject({
    lcsc: 2651328,
    package: "X2QFN-10",
    is_preferred: true,
    resolution_bits: 16,
    sampling_rate_hz: 860,
    num_channels: 4,
    supply_voltage_min: 2,
    supply_voltage_max: 5.5,
    has_i2c: true,
    has_spi: false,
    is_differential: true,
    operating_temp_min: -40,
    operating_temp_max: 125,
  })

  expect(mapped[1]).toMatchObject({
    lcsc: 626764,
    package: "SOIC-16",
    resolution_bits: 12,
    sampling_rate_hz: 100_000,
    supply_voltage_min: 2.7,
    supply_voltage_max: 5.5,
    has_spi: true,
    operating_temp_min: -40,
    operating_temp_max: 85,
  })

  expect(mapped[2]).toMatchObject({
    lcsc: 100200,
    resolution_bits: 24,
    sampling_rate_hz: 96_000,
    num_channels: 2,
    supply_voltage_min: 2.7,
    supply_voltage_max: 5.5,
    has_serial_interface: true,
    operating_temp_min: -20,
    operating_temp_max: 85,
  })
})

test("dac table maps current JLCPCB attributes including ns settling times and bare INL", () => {
  const mapped = dacTableSpec.mapToTable([
    {
      lcsc: 478093,
      mfr: "MCP4728T-E/UN",
      description:
        "-40℃~+125℃ 12 2.7V~5.5V 2LSB 4 40nA 6us I2C Voltage Buffer MSOP-10 Digital To Analog Converters (DAC) ROHS",
      stock: 15101,
      basic: 0,
      preferred: 1,
      price: JSON.stringify([{ qFrom: 1, qTo: null, price: 1.56 }]),
      package: "MSOP-10",
      extra: JSON.stringify({
        attributes: {
          "Resolution (Bits)": "12",
          "Number of Channels": "4",
          "Settling Time": "6us",
          "Voltage - Supply": "2.7V~5.5V",
          "Integral non - linearity": "2LSB",
          Interface: "I2C",
          "Output Type": "Voltage Buffer",
          "Operating Temperature": "-40℃~+125℃",
        },
      }),
    } as any,
    {
      lcsc: 300400,
      mfr: "DAC904E",
      description: "14-Bit High-Speed DAC",
      stock: 420,
      basic: 0,
      preferred: 0,
      price: "1-9:3.20",
      package: "TSSOP-28",
      extra: JSON.stringify({
        attributes: {
          "Resolution (Bits)": "12, 16, 10, 14",
          "Number of Channels": "1",
          "Settling Time": "500ns",
          "Voltage - Supply": "1.66V~1.94V, 3V~5.25V",
          "Integral non - linearity": "0.5LSB",
          Interface: "Parallel port",
          "Output Type": "Current-Non-buffered",
          "Operating Temperature": "-40℃~+85℃",
        },
      }),
    } as any,
    {
      lcsc: 61423,
      mfr: "MCP4725A1T-E/CH",
      description:
        "-40℃~+125℃ 12-Bit 2.7V~5.5V 2LSB 6us I2C SOT-23-6 Digital To Analog Converters (DAC) ROHS",
      stock: 948,
      basic: 0,
      preferred: 0,
      price: "1-9:0.55",
      package: "SOT-23-6",
      extra: null,
    } as any,
  ])

  expect(mapped[0]).toMatchObject({
    lcsc: 478093,
    package: "MSOP-10",
    is_preferred: true,
    resolution_bits: 12,
    num_channels: 4,
    settling_time_us: 6,
    supply_voltage_min: 2.7,
    supply_voltage_max: 5.5,
    nonlinearity_lsb: 2,
    has_i2c: true,
    has_spi: false,
    output_type: "Voltage Buffer",
    operating_temp_min: -40,
    operating_temp_max: 125,
  })

  expect(mapped[1]).toMatchObject({
    lcsc: 300400,
    resolution_bits: 16,
    num_channels: 1,
    settling_time_us: 0.5,
    supply_voltage_min: 1.66,
    supply_voltage_max: 5.25,
    nonlinearity_lsb: 0.5,
    has_parallel_interface: true,
    output_type: "Current-Non-buffered",
    operating_temp_min: -40,
    operating_temp_max: 85,
  })

  expect(mapped[2]).toMatchObject({
    lcsc: 61423,
    resolution_bits: 12,
    settling_time_us: 6,
    supply_voltage_min: 2.7,
    supply_voltage_max: 5.5,
    nonlinearity_lsb: 2,
    has_i2c: true,
    operating_temp_min: -40,
    operating_temp_max: 125,
  })
})

test("buildDerivedSyncDatabase populates adc and dac rows from Data Acquisition singular subcategories", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "jlcsearch-adc-dac-"))
  const sourcePath = path.join(dir, "source.sqlite3")
  const outputPath = path.join(dir, "derived.sqlite3")

  try {
    const source = new Database(sourcePath, { create: true })
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
        `INSERT INTO jlc_components VALUES
          (6705483, unixepoch(), 1, 1, 'Data Acquisition', 'Analog To Digital Converters (ADC)', 'HX711', 'SOP-16', 16, 'AVIA', 'base', 0, unixepoch(), '24-Bit Load Cell ADC', '', 124638, '[{"qFrom":1,"qTo":null,"price":0.31}]', ?),
          (478093, unixepoch(), 1, 1, 'Data Acquisition', 'Digital To Analog Converters (DAC)', 'MCP4728T-E/UN', 'MSOP-10', 10, 'Microchip', 'expand', 1, unixepoch(), 'Quad 12-Bit DAC', '', 15101, '[{"qFrom":1,"qTo":null,"price":1.56}]', ?)`,
      )
      .run(
        JSON.stringify({
          "Resolution (Bits)": "24",
          "Sampling Rate": "10Hz, 80Hz",
          "Voltage - Supply": "2.6V~5.5V",
          "number of channels": "2",
          Interface: "Serial port",
          "differential input": "Yes",
          "Operating Temperature": "-40℃~+85℃",
        }),
        JSON.stringify({
          "Resolution (Bits)": "12",
          "Number of Channels": "4",
          "Settling Time": "6us",
          "Voltage - Supply": "2.7V~5.5V",
          "Integral non - linearity": "2LSB",
          Interface: "I2C",
          "Output Type": "Voltage Buffer",
          "Operating Temperature": "-40℃~+125℃",
        }),
      )
    source.close()

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      tableNames: ["adc", "dac"],
      logger: () => {},
    })

    const derived = new Database(outputPath, { readonly: true })
    try {
      const adcRow = derived
        .query("SELECT * FROM adc WHERE lcsc = 6705483")
        .get() as Record<string, unknown>
      const dacRow = derived
        .query("SELECT * FROM dac WHERE lcsc = 478093")
        .get() as Record<string, unknown>

      expect(adcRow).toMatchObject({
        lcsc: 6705483,
        mfr: "HX711",
        resolution_bits: 24,
        sampling_rate_hz: 80,
        num_channels: 2,
        supply_voltage_min: 2.6,
        supply_voltage_max: 5.5,
        has_serial_interface: 1,
        is_differential: 1,
      })

      expect(dacRow).toMatchObject({
        lcsc: 478093,
        mfr: "MCP4728T-E/UN",
        resolution_bits: 12,
        num_channels: 4,
        settling_time_us: 6,
        supply_voltage_min: 2.7,
        supply_voltage_max: 5.5,
        nonlinearity_lsb: 2,
        has_i2c: 1,
      })
    } finally {
      derived.close()
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
