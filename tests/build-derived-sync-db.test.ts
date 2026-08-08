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
      ) VALUES (
        12345, unixepoch(), 1, 1, 'Connectors',
        'HDMI Connectors', 'HDMI-19P', 'SMD', 19, 'Example', 'base', 1,
        unixepoch(), 'HDMI Female 19 Pins horizontal attachment', '', 250,
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
      .map((directory) =>
        rm(directory, { recursive: true, force: true }).catch(() => {}),
      ),
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
})

describe("extractMinQPrice", () => {
  test("reads source-db-v2 price CSV", () => {
    expect(extractMinQPrice("10-:0.75,1-9:1.25")).toBe(1.25)
  })
})
