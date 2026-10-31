import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { parseFrequencyHz } from "lib/util/parse-frequency-hz"
import { microcontrollerTableSpec } from "lib/db/derivedtables/microcontroller"
import { queryTable, TABLE_CONFIGS } from "../../cf-proxy/src/handlers"

const component = (speed: unknown) =>
  ({
    lcsc: 1,
    mfr: "UNKNOWN",
    description: "Runtime oscillator 800MHz",
    stock: 1,
    price: "[]",
    package: "QFN",
    extra: JSON.stringify({ attributes: { "CPU Maximum Speed": speed } }),
  }) as Parameters<typeof microcontrollerTableSpec.mapToTable>[0][number]

describe("catalog maximum CPU clock normalization", () => {
  test.each([
    ["133MHz", 133e6], // RP2040 in the catalog documentation and public API
    ["72MHz", 72e6], // STM32F103C8T6
    ["16MHz", 16e6], // STM8S003F3P6TR
    ["32.768 kHz", 32768],
    ["0.5MHz", 500000],
    [".5 MHz", 500000],
    [" 72000000 Hz ", 72e6],
    ["72000KHZ", 72e6],
  ])("normalizes %s into Hz for extraction and queries", (raw, hz) => {
    expect(parseFrequencyHz(raw)).toBe(hz)
    expect(parseFrequencyHz(raw, true)).toBe(hz)
    expect(
      microcontrollerTableSpec.mapToTable([component(raw)])[0]?.cpu_speed_hz,
    ).toBe(hz)
  })

  test.each([
    undefined,
    null,
    "",
    "-",
    "unknown",
    72,
    {},
    "72",
    "0Hz",
    "-1MHz",
    "InfinityMHz",
    "NaNHz",
    "1e999MHz",
    "9007199254740992Hz",
    "12.3.4MHz",
    "16MHz~72MHz",
    "72MHz;48MHz",
    "up to 72MHz",
    "72MHz junk",
  ])("keeps unavailable or ambiguous catalog rating %j unknown", (raw) => {
    expect(parseFrequencyHz(raw)).toBeNull()
    expect(
      microcontrollerTableSpec.mapToTable([component(raw)])[0]?.cpu_speed_hz,
    ).toBeNull()
  })

  test("bare query values mean Hz, with no description fallback", () => {
    expect(parseFrequencyHz("72000000", true)).toBe(72e6)
    expect(parseFrequencyHz("72", true)).toBe(72)
    expect(parseFrequencyHz("72oops", true)).toBeNull()
  })
})

test("minimum rating includes equality, intersects filters, and excludes unknown or invalid storage", async () => {
  const database = new Database(":memory:")
  database.exec(`CREATE TABLE microcontroller (
    lcsc INTEGER, stock INTEGER, cpu_speed_hz REAL, package TEXT, has_usb BOOLEAN
  );
  INSERT INTO microcontroller VALUES
    (1, 100, 71999999, 'QFN', 1),
    (2, 90, 72000000, 'QFN', 1),
    (3, 80, 133000000, 'QFN', 0),
    (4, 70, NULL, 'QFN', 1),
    (5, 60, 'unknown', 'QFN', 1),
    (6, 50, 0, 'QFN', 1),
    (7, 40, -1, 'QFN', 1),
    (8, 30, 1e999, 'QFN', 1),
    (9, 20, 96000000, 'DIP', 1);
  CREATE TABLE resistor (lcsc INTEGER, stock INTEGER);
  INSERT INTO resistor VALUES (10, 100);`)
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  try {
    const query = (params: Record<string, string>) =>
      queryTable(
        db as unknown as Parameters<typeof queryTable>[0],
        "microcontroller",
        params,
        TABLE_CONFIGS.microcontroller,
      )
    for (const threshold of ["72MHz", "72000kHz", "72000000Hz", "72000000"]) {
      expect(await query({ cpu_speed_min_hz: threshold })).toMatchObject([
        { lcsc: 2 },
        { lcsc: 3 },
        { lcsc: 9 },
      ])
    }
    expect(
      await query({
        cpu_speed_min_hz: "72MHz",
        package: "QFN",
        has_usb: "true",
      }),
    ).toMatchObject([{ lcsc: 2 }])
    expect(await query({ cpu_speed_min_hz: "133000001" })).toEqual([])
    for (const threshold of [
      "All",
      "oops",
      "72MHz OR 1=1",
      "Infinity",
      "-1",
      "0",
      " ",
      "1e99",
    ]) {
      expect(await query({ cpu_speed_min_hz: threshold })).toEqual([])
    }
    expect(await query({})).toHaveLength(9)
    expect(await query({ cpu_speed_min_hz: "" })).toHaveLength(9)
    expect(
      await queryTable(
        db as unknown as Parameters<typeof queryTable>[0],
        "resistor",
        { cpu_speed_min_hz: "72MHz" },
        TABLE_CONFIGS.resistor,
      ),
    ).toMatchObject([{ lcsc: 10 }])
  } finally {
    await db.destroy()
  }
})

test("MCU extraction candidates stay within existing MCU categories", async () => {
  const database = new Database(":memory:")
  database.exec(`CREATE TABLE categories (id INTEGER, subcategory TEXT);
    CREATE TABLE components (lcsc INTEGER, category_id INTEGER);
    INSERT INTO categories VALUES (1, 'Microcontroller Units (MCUs/MPUs/SOCs)'), (2, 'Resistors');
    INSERT INTO components VALUES (2040, 1), (999, 2);`)
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  try {
    expect(
      await microcontrollerTableSpec.listCandidateComponents(db).execute(),
    ).toMatchObject([{ lcsc: 2040 }])
  } finally {
    await db.destroy()
  }
})
