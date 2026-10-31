import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { parseFrequencyHz } from "lib/util/parse-frequency-hz"
import { microcontrollerTableSpec } from "lib/db/derivedtables/microcontroller"
import type { DB } from "lib/db/generated/kysely"

const component = (
  speed: unknown,
): Parameters<typeof microcontrollerTableSpec.mapToTable>[0][number] => ({
  lcsc: 1,
  mfr: "UNKNOWN",
  description: "Runtime oscillator 800MHz",
  stock: 1,
  price: "[]",
  package: "QFN",
  extra: JSON.stringify({ attributes: { "CPU Maximum Speed": speed } }),
  basic: 0,
  category_id: 1,
  datasheet: "",
  flag: 0,
  joints: 0,
  last_on_stock: 0,
  last_update: 0,
  manufacturer_id: 0,
  preferred: 0,
})

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

test("MCU extraction candidates stay within existing MCU categories", async () => {
  const database = new Database(":memory:")
  database.exec(`CREATE TABLE categories (id INTEGER, subcategory TEXT);
    CREATE TABLE components (lcsc INTEGER, category_id INTEGER);
    INSERT INTO categories VALUES (1, 'Microcontroller Units (MCUs/MPUs/SOCs)'), (2, 'Resistors');
    INSERT INTO components VALUES (2040, 1), (999, 2);`)
  const db = new Kysely<DB>({ dialect: new BunSqliteDialect({ database }) })
  try {
    expect(
      await microcontrollerTableSpec.listCandidateComponents(db).execute(),
    ).toMatchObject([{ lcsc: 2040 }])
  } finally {
    await db.destroy()
  }
})
