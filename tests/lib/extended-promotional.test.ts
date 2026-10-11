import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { afterEach, beforeEach } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { headerTableSpec } from "../../lib/db/derivedtables/header"
import { buildDerivedSyncDatabase } from "../../scripts/build-derived-sync-db"

// ---------------------------------------------------------------------------
// Unit tests: mapToTable derives is_extended_promotional from the component row
// ---------------------------------------------------------------------------

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 123,
    mfr: "TEST-PART",
    description: "",
    stock: 100,
    basic: 0,
    preferred: 0,
    is_extended_promotional: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.1 }]),
    package: "TH",
    extra: JSON.stringify({
      attributes: {
        Pitch: "2.54mm",
        "Number of Pins": "16P",
        "Mounting Type": "Straight",
      },
    }),
    source_subcategory: "Pin Headers",
    ...overrides,
  }) as any

describe("is_extended_promotional mapping", () => {
  test("basic + preferred maps to false", () => {
    const [row] = headerTableSpec.mapToTable([
      makeComponent({ basic: 1, preferred: 1 }),
    ])

    expect(row?.is_basic).toBe(true)
    expect(row?.is_preferred).toBe(true)
    expect(row?.is_extended_promotional).toBe(false)
  })

  test("extended-library + preferred maps to true", () => {
    // is_extended_promotional is derived upstream by the components temp view
    // (library_type != 'base' AND preferred = 1); the fixture simulates its output
    const [row] = headerTableSpec.mapToTable([
      makeComponent({ basic: 0, preferred: 1, is_extended_promotional: 1 }),
    ])

    expect(row?.is_basic).toBe(false)
    expect(row?.is_preferred).toBe(true)
    expect(row?.is_extended_promotional).toBe(true)
  })

  test("extended-library + non-preferred maps to false", () => {
    const [row] = headerTableSpec.mapToTable([
      makeComponent({ basic: 0, preferred: 0 }),
    ])

    expect(row?.is_basic).toBe(false)
    expect(row?.is_preferred).toBe(false)
    expect(row?.is_extended_promotional).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Integration test: the derived sync DB temp view computes the flag from
// library_type != 'base' AND preferred = 1 without new upstream fields
// ---------------------------------------------------------------------------

let tempDirectory: string

beforeEach(async () => {
  tempDirectory = await mkdtemp(path.join(tmpdir(), "jlcsearch-extpromo-"))
})

afterEach(async () => {
  await rm(tempDirectory, { recursive: true, force: true })
})

const insertJlcComponent = (
  source: Database,
  {
    lcsc,
    libraryType,
    preferred,
  }: { lcsc: number; libraryType: string; preferred: number },
) => {
  source
    .query(
      `INSERT INTO jlc_components (
        lcsc, fetched_at, present, sync_seen, category, subcategory, mfr,
        package, joints, manufacturer, library_type, preferred, last_on_stock,
        description, datasheet, stock, price, attributes
      ) VALUES (
        ?, unixepoch(), 1, 1, 'Connectors',
        'HDMI Connectors', ?, 'SMD', 19, 'Example', ?, ?,
        unixepoch(), 'HDMI Female 19 Pins horizontal attachment', '', 250,
        '1-9:1.25,10-:0.75',
        '{"Connector Type":"HDMI","Number of Pins":"19"}'
      )`,
    )
    .run(lcsc, `HDMI-${lcsc}`, libraryType, preferred)
}

test("derived sync db computes is_extended_promotional in hdmi_port", async () => {
  const sourcePath = path.join(tempDirectory, "source.sqlite3")
  const outputPath = path.join(tempDirectory, "derived.sqlite3")
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

  // Basic (base library) + preferred -> not extended promotional
  insertJlcComponent(source, {
    lcsc: 12345,
    libraryType: "base",
    preferred: 1,
  })
  // Extended library + preferred -> extended promotional
  insertJlcComponent(source, {
    lcsc: 12346,
    libraryType: "expand",
    preferred: 1,
  })
  // Extended library + non-preferred -> not extended promotional
  insertJlcComponent(source, {
    lcsc: 12347,
    libraryType: "expand",
    preferred: 0,
  })

  for (const lcsc of [12345, 12346, 12347]) {
    source
      .query(
        `INSERT INTO lcsc_components (
          lcsc, fetched_at, manufacturer, attributes, image, url_slug
        ) VALUES (
          ?, unixepoch(), 'Example Inc.',
          '{"Gender":"Female","Mounting Style":"Surface Mount"}',
          'example.jpg', ?
        )`,
      )
      .run(lcsc, `hdmi-${lcsc}`)
  }
  source.close()

  await buildDerivedSyncDatabase({
    sourcePath,
    outputPath,
    tableNames: ["hdmi_port"],
    logger: () => {},
  })

  const output = new Database(outputPath, { readonly: true })
  const rows = output
    .query(
      `SELECT lcsc, is_basic, is_preferred, is_extended_promotional
       FROM hdmi_port
       ORDER BY lcsc`,
    )
    .all() as Array<Record<string, unknown>>

  expect(rows).toEqual([
    {
      lcsc: 12345,
      is_basic: 1,
      is_preferred: 1,
      is_extended_promotional: 0,
    },
    {
      lcsc: 12346,
      is_basic: 0,
      is_preferred: 1,
      is_extended_promotional: 1,
    },
    {
      lcsc: 12347,
      is_basic: 0,
      is_preferred: 0,
      is_extended_promotional: 0,
    },
  ])
  output.close()
})
