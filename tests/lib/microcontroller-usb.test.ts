import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import audit from "lib/db/derivedtables/microcontroller-usb-audit.json"
import { microcontrollerTableSpec } from "lib/db/derivedtables/microcontroller"
import { generateMicrocontrollerUsbMigration } from "../../scripts/generate-microcontroller-usb-migration"

const component = (mfr: string, description = "", attributes = {}) =>
  ({
    lcsc: 2040,
    mfr,
    description,
    stock: 10,
    price: "[]",
    basic: 0,
    preferred: 0,
    package: "QFN",
    extra: JSON.stringify({ attributes }),
  }) as any

const usb = (mfr: string, description = "", attributes = {}) =>
  microcontrollerTableSpec.mapToTable([
    component(mfr, description, attributes),
  ])[0]?.has_usb

test("USB overrides survive missing supplier features and reject PD-only parts", () => {
  expect(usb("RP2040")).toBe(true)
  expect(usb(" rp2040 ")).toBe(true)
  expect(usb("STM32F103C8T6")).toBe(true)
  expect(usb("STM32G431CBT6")).toBe(true)
  expect(usb("STM32G071CBT6", "USB Type-C Power Delivery")).toBe(false)
  expect(usb("STM32L431CCT6", "", { "Universal Serial Bus": "Yes" })).toBe(
    false,
  )
  expect(usb("STM32L432KBU6")).toBe(true)
})

test("unaudited parts retain supplier detection, without broad family guesses", () => {
  expect(usb("UNAUDITED", "USB 2.0 full speed")).toBe(true)
  expect(usb("UNAUDITED", "", { "Universal Serial Bus": "Yes" })).toBe(true)
  expect(usb("UNAUDITED")).toBe(false)
  expect(usb("RP2040-UNVERIFIED")).toBe(false)
})

test("migration corrects audited rows, preserves other data, and is idempotent", async () => {
  const migration = await Bun.file(
    "cf-proxy/migrations/0011_microcontroller_usb.sql",
  ).text()
  expect(migration).toBe(generateMicrocontrollerUsbMigration())
  expect(audit).toHaveLength(100)
  expect(new Set(audit.map((r) => r.mfr)).size).toBe(100)
  const db = new Database(":memory:")
  try {
    db.run(
      "CREATE TABLE microcontroller (lcsc INTEGER PRIMARY KEY, mfr TEXT, has_usb INTEGER, stock INTEGER)",
    )
    const insert = db.prepare("INSERT INTO microcontroller VALUES (?, ?, ?, ?)")
    for (const row of audit) {
      insert.run(row.lcsc, row.mfr, Number(row.previous_has_usb), 123)
      expect(new URL(row.source_url).protocol).toBe("https:")
      expect(usb(row.mfr)).toBe(row.has_usb)
    }
    insert.run(-1, "UNAUDITED", 1, 456)
    insert.run(-2, "RP2040-UNVERIFIED", 0, 789)
    db.exec(migration)
    expect(
      db
        .query("SELECT COUNT(*) AS n FROM microcontroller WHERE has_usb = 1")
        .get(),
    ).toEqual({ n: 34 })
    for (const row of audit) {
      expect(
        db
          .query("SELECT has_usb, stock FROM microcontroller WHERE lcsc = ?")
          .get(row.lcsc),
      ).toEqual({ has_usb: Number(row.has_usb), stock: 123 })
    }
    const before = db.query("SELECT * FROM microcontroller ORDER BY lcsc").all()
    db.exec(migration)
    expect(
      db.query("SELECT * FROM microcontroller ORDER BY lcsc").all(),
    ).toEqual(before)
    expect(
      db
        .query("SELECT has_usb, stock FROM microcontroller WHERE lcsc = -2")
        .get(),
    ).toEqual({ has_usb: 0, stock: 789 })
  } finally {
    db.close()
  }
})
