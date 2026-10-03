import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { extractMinQPrice } from "../lib/util/extract-min-quantity-price"
import { buildDerivedSyncDatabase } from "../scripts/build-derived-sync-db"

const tempDirectories: string[] = []

const createSourceDatabase = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "jlcsearch-source-v2-"))
  tempDirectories.push(directory)
  const sourcePath = path.join(directory, "source.sqlite3")
  const outputPath = path.join(directory, "derived.sqlite3")
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
      is_extended_promotional INTEGER,
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
        package, joints, manufacturer, library_type, preferred, last_on_stock, is_extended_promotional,
        description, datasheet, stock, price, attributes
      ) VALUES (
        12345, unixepoch(), 1, 1, 'Connectors',
        'HDMI Connectors', 'HDMI-19P', 'SMD', 19, 'Example', 'base', 1,
        unixepoch(), 0, 'HDMI Female 19 Pins horizontal attachment', '', 250,
        '1-9:1.25,10-:0.75',
        '{"Connector Type":"HDMI","Number of Pins":"19"}'
      )`,
    )
    .run()

  source
    .query(
      `INSERT INTO lcsc_components (
        lcsc, fetched_at, manufacturer, attributes, image, url_slug
      ) VALUES (
        12345, unixepoch(), 'Example Inc.',
        '{"Gender":"Female","Mounting Style":"Surface Mount"}',
        'example.jpg', 'hdmi-19p'
      )`,
    )
    .run()
  source.close()

  return { sourcePath, outputPath }
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe("buildDerivedSyncDatabase", () => {
  test("converts source-db-v2 rows into a populated HDMI derived table", async () => {
    const { sourcePath, outputPath } = await createSourceDatabase()

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      tableNames: ["hdmi_port"],
      logger: () => {},
    })

    const output = new Database(outputPath, { readonly: true })
    const row = output
      .query(
        `SELECT
          lcsc, price1, number_of_pins, gender, mounting_style,
          is_basic, is_preferred
        FROM hdmi_port`,
      )
      .get() as Record<string, unknown>

    expect(row).toEqual({
      lcsc: 12345,
      price1: 1.25,
      number_of_pins: 19,
      gender: "Female",
      mounting_style: "Surface Mount",
      is_basic: 1,
      is_preferred: 1,
    })
    output.close()
  })

  test("builds optical navigation sensors from mixed source-db-v2 categories", async () => {
    const { sourcePath, outputPath } = await createSourceDatabase()
    const source = new Database(sourcePath)
    source.exec(`
      DELETE FROM lcsc_components;
      UPDATE jlc_components SET
        category = 'Sensors', subcategory = 'Specialized Sensors',
        mfr = 'PAW3220LU-TJDU', manufacturer = 'PixArt',
        package = 'DIP-8', description = '', attributes = '{}';
    `)
    source.close()

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      tableNames: ["optical_sensor"],
      logger: () => {},
    })

    const output = new Database(outputPath, { readonly: true })
    try {
      expect(
        output
          .query(`SELECT mfr, package, sensor_type, stock,
        price1, is_basic, is_preferred FROM optical_sensor`)
          .get(),
      ).toEqual({
        mfr: "PAW3220LU-TJDU",
        package: "DIP-8",
        sensor_type: "Optical Motion",
        stock: 250,
        price1: 1.25,
        is_basic: 1,
        is_preferred: 1,
      })
    } finally {
      output.close()
    }
  })

  test("uses JLC manufacturer metadata for NPU chips missing from LCSC", async () => {
    const { sourcePath, outputPath } = await createSourceDatabase()
    const source = new Database(sourcePath)
    source
      .query(
        `INSERT INTO jlc_components (
          lcsc, fetched_at, present, sync_seen, category, subcategory, mfr,
          package, joints, manufacturer, library_type, preferred, last_on_stock, is_extended_promotional,
          description, datasheet, stock, price, attributes
        ) VALUES (
          67890, unixepoch(), 1, 1, 'Embedded Processors & Controllers',
          'Microcontrollers (MCU/MPU/SOC)', 'MIMX9352CVVXMAC', 'VFBGA-396',
          396, 'NXP', 'expand', 0, unixepoch(), 0,
          '64 Bit Microcontrollers (MCU/MPU/SOC)', '', 0, '1-:35.00', '{}'
        )`,
      )
      .run()
    source.close()

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      tableNames: ["npu_chip"],
      logger: () => {},
    })

    const output = new Database(outputPath, { readonly: true })
    expect(
      output
        .query(
          "SELECT manufacturer, chip_family, npu_name FROM npu_chip WHERE lcsc = 67890",
        )
        .get(),
    ).toEqual({
      manufacturer: "NXP",
      chip_family: "NXP i.MX 93",
      npu_name: "Arm Ethos-U65",
    })
    output.close()
  })

  test("builds Linux-capable processors from source-db-v2 manufacturer metadata", async () => {
    const { sourcePath, outputPath } = await createSourceDatabase()
    const source = new Database(sourcePath)
    source.exec(`
      DELETE FROM lcsc_components;
      UPDATE jlc_components SET
        category = 'Embedded Processors & Controllers',
        subcategory = 'Microcontrollers (MCU/MPU/SOC)',
        mfr = 'STM32MP157AAC3', manufacturer = 'STMicroelectronics',
        package = 'LFBGA-361', description = 'Arm Cortex-A7 microprocessor',
        attributes = '{}';
    `)
    source.close()

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      tableNames: ["linux_capable_processor"],
      logger: () => {},
    })

    const output = new Database(outputPath, { readonly: true })
    try {
      expect(
        output
          .query(
            `SELECT mfr, manufacturer, architecture, package, stock,
              price1, is_basic, is_preferred FROM linux_capable_processor`,
          )
          .get(),
      ).toEqual({
        mfr: "STM32MP157AAC3",
        manufacturer: "STMicroelectronics",
        architecture: "ARM32",
        package: "LFBGA-361",
        stock: 250,
        price1: 1.25,
        is_basic: 1,
        is_preferred: 1,
      })
    } finally {
      output.close()
    }
  })

  test("rejects unknown derived tables", async () => {
    const { sourcePath, outputPath } = await createSourceDatabase()

    expect(
      buildDerivedSyncDatabase({
        sourcePath,
        outputPath,
        tableNames: ["not_a_table"],
        logger: () => {},
      }),
    ).rejects.toThrow("Unknown derived table: not_a_table")
  })

  test("materializes a component catalog from source-db-v2", async () => {
    const { sourcePath, outputPath } = await createSourceDatabase()

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      tableNames: ["hdmi_port"],
      includeComponentCatalog: true,
      logger: () => {},
    })

    const output = new Database(outputPath, { readonly: true })
    const row = output
      .query(
        `SELECT
          lcsc, mfr, category, subcategory, basic, preferred, stock,
          json_extract(extra, '$.manufacturer.name') AS manufacturer,
          json_extract(extra, '$.mpn') AS mpn,
          json_extract(extra, '$.attributes.Gender') AS gender
        FROM component_catalog`,
      )
      .get() as Record<string, unknown>

    expect(row).toEqual({
      lcsc: 12345,
      mfr: "HDMI-19P",
      category: "Connectors",
      subcategory: "HDMI Connectors",
      basic: 1,
      preferred: 1,
      stock: 250,
      manufacturer: "Example Inc.",
      mpn: "HDMI-19P",
      gender: "Female",
    })
    output.close()
  })

  test("materializes a stock snapshot with zeroes for absent parts", async () => {
    const { sourcePath, outputPath } = await createSourceDatabase()
    const source = new Database(sourcePath)
    source
      .query(
        `INSERT INTO jlc_components (
          lcsc, fetched_at, present, sync_seen, category, subcategory, mfr,
          package, joints, manufacturer, library_type, preferred, last_on_stock, is_extended_promotional,
          description, datasheet, stock, price, attributes
        ) VALUES (
          54321, unixepoch(), 0, 1, 'Connectors',
          'HDMI Connectors', 'REMOVED', 'SMD', 19, 'Example', 'base', 0,
          unixepoch(), 0, 'No longer listed', '', 125, '1-:1.00', '{}'
        )`,
      )
      .run()
    source.close()

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      tableNames: ["hdmi_port"],
      includeStockSnapshot: true,
      logger: () => {},
    })

    const output = new Database(outputPath, { readonly: true })
    expect(
      output
        .query("SELECT lcsc, stock FROM component_stock ORDER BY lcsc")
        .all(),
    ).toEqual([
      { lcsc: 12345, stock: 250 },
      { lcsc: 54321, stock: 0 },
    ])
    output.close()
  })
})

test("recovery restores absent records while preserving current stock and explicit removals", async () => {
  const current = await createSourceDatabase()
  const backup = await createSourceDatabase()
  const source = new Database(current.sourcePath)
  source.exec(
    "UPDATE jlc_components SET stock=7; INSERT INTO jlc_components SELECT 54321, fetched_at, 0, sync_seen, category, subcategory, mfr, package, joints, manufacturer, library_type, preferred, last_on_stock, description, datasheet, 99, price, attributes FROM jlc_components WHERE lcsc=12345",
  )
  source.close()
  const recovery = new Database(backup.sourcePath)
  recovery.exec(
    "INSERT INTO jlc_components SELECT 99999, fetched_at, present, sync_seen, category, subcategory, mfr, package, joints, manufacturer, library_type, preferred, last_on_stock, description, datasheet, stock, price, attributes FROM jlc_components WHERE lcsc=12345; INSERT INTO jlc_components SELECT 54321, fetched_at, present, sync_seen, category, subcategory, mfr, package, joints, manufacturer, library_type, preferred, last_on_stock, description, datasheet, stock, price, attributes FROM jlc_components WHERE lcsc=12345",
  )
  recovery.exec(
    "UPDATE lcsc_components SET manufacturer='Older Manufacturer', attributes='{\"Gender\":\"Older\"}'; INSERT INTO lcsc_components SELECT 99999,fetched_at,'Recovered Manufacturer','{\"Gender\":\"Female\"}',image,url_slug FROM lcsc_components WHERE lcsc=12345",
  )
  recovery.close()
  await buildDerivedSyncDatabase({
    sourcePath: current.sourcePath,
    outputPath: current.outputPath,
    recoveryPath: backup.sourcePath,
    tableNames: ["hdmi_port"],
    includeComponentCatalog: true,
    includeStockSnapshot: true,
    logger: () => {},
  })
  const output = new Database(current.outputPath)
  try {
    const catalogExtras = output
      .query<{ lcsc: number; extra: string }, []>(
        "SELECT lcsc, extra FROM component_catalog ORDER BY lcsc",
      )
      .all()
    expect(JSON.parse(catalogExtras[0].extra).manufacturer.name).toBe(
      "Example Inc.",
    )
    expect(JSON.parse(catalogExtras[1].extra).manufacturer.name).toBe(
      "Recovered Manufacturer",
    )
    expect(JSON.parse(catalogExtras[1].extra).attributes.Gender).toBe("Female")
    expect(
      output
        .query("SELECT lcsc, stock FROM component_catalog ORDER BY lcsc")
        .all(),
    ).toEqual([
      { lcsc: 12345, stock: 7 },
      { lcsc: 99999, stock: 250 },
    ])
    expect(
      output
        .query("SELECT lcsc, stock FROM component_stock ORDER BY lcsc")
        .all(),
    ).toEqual([
      { lcsc: 12345, stock: 7 },
      { lcsc: 54321, stock: 0 },
      { lcsc: 99999, stock: 250 },
    ])
    expect(
      output.query("SELECT lcsc, stock FROM hdmi_port ORDER BY lcsc").all(),
    ).toEqual([
      { lcsc: 12345, stock: 7 },
      { lcsc: 99999, stock: 250 },
    ])
  } finally {
    output.close()
  }
})

describe("extractMinQPrice", () => {
  test("reads source-db-v2 price CSV", () => {
    expect(extractMinQPrice("10-:0.75,1-9:1.25")).toBe(1.25)
  })
})

test("refuses to overwrite the recovery source before touching either database", async () => {
  const current = await createSourceDatabase()
  const backup = await createSourceDatabase()
  await expect(
    buildDerivedSyncDatabase({
      sourcePath: current.sourcePath,
      outputPath: backup.sourcePath,
      recoveryPath: backup.sourcePath,
      tableNames: ["hdmi_port"],
    }),
  ).rejects.toThrow("differ from the output")
  const source = new Database(backup.sourcePath, { readonly: true })
  try {
    expect(
      source.query("SELECT stock FROM jlc_components WHERE lcsc=12345").get(),
    ).toEqual({ stock: 250 })
  } finally {
    source.close()
  }
})
