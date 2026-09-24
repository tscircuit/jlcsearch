import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import audit from "lib/db/derivedtables/microcontroller-usb-audit.json"
import next200 from "lib/db/derivedtables/microcontroller-usb-audit-next200.json"
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

test("next 200 audit is disjoint and every decision survives a data rebuild", () => {
  expect(next200).toHaveLength(200)
  const all = [...audit, ...next200]
  expect(new Set(all.map((row) => row.lcsc)).size).toBe(300)
  expect(new Set(all.map((row) => row.mfr.toUpperCase())).size).toBe(300)
  expect(next200.filter((row) => row.has_usb)).toHaveLength(64)
  for (const [index, row] of next200.entries()) {
    expect(row.rank).toBe(index + 101)
    expect(new URL(row.source_url).protocol).toBe("https:")
    expect(usb(row.mfr, "USB", { "Universal Serial Bus": "Yes" })).toBe(
      row.has_usb,
    )
  }
  expect(usb(" v3S ")).toBe(true)
  expect(usb("STM32F070F6P6")).toBe(true)
  expect(usb("STC8H3K64S4-45I-LQFP48", "USB software download")).toBe(false)
  expect(usb("CW32L031C8U6", "CRC16_USB")).toBe(false)
  expect(usb("STM32F070F6P6-UNVERIFIED")).toBe(false)
})

test("next 200 migration corrects only reviewed parts and can run repeatedly", async () => {
  const migration = await Bun.file(
    "cf-proxy/migrations/0012_microcontroller_usb_next200.sql",
  ).text()
  expect(migration).toBe(generateMicrocontrollerUsbMigration("next200"))
  const db = new Database(":memory:")
  try {
    db.run(
      "CREATE TABLE microcontroller (lcsc INTEGER PRIMARY KEY, mfr TEXT, has_usb INTEGER, stock INTEGER)",
    )
    const insert = db.prepare("INSERT INTO microcontroller VALUES (?, ?, ?, ?)")
    for (const row of next200)
      insert.run(
        row.lcsc,
        ` ${row.mfr.toLowerCase()} `,
        Number(!row.has_usb),
        123,
      )
    insert.run(-1, "UNAUDITED", 1, 456)
    insert.run(-2, "STM32F070F6P6-UNVERIFIED", 0, 789)
    db.exec(migration)
    for (const row of next200) {
      expect(
        db
          .query("SELECT has_usb, stock FROM microcontroller WHERE lcsc = ?")
          .get(row.lcsc),
      ).toEqual({ has_usb: Number(row.has_usb), stock: 123 })
    }
    expect(
      db
        .query("SELECT has_usb, stock FROM microcontroller WHERE lcsc = -1")
        .get(),
    ).toEqual({ has_usb: 1, stock: 456 })
    expect(
      db
        .query("SELECT has_usb, stock FROM microcontroller WHERE lcsc = -2")
        .get(),
    ).toEqual({ has_usb: 0, stock: 789 })
    const before = db.query("SELECT * FROM microcontroller ORDER BY lcsc").all()
    db.exec(migration)
    expect(
      db.query("SELECT * FROM microcontroller ORDER BY lcsc").all(),
    ).toEqual(before)
  } finally {
    db.close()
  }
})
