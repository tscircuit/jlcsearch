import { expect, test } from "bun:test"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"
import { mapBleFields } from "lib/db/derivedtables/ble-utils"
import { DERIVED_TABLES } from "lib/db/derivedtables/setup-derived-tables"

const makeCapacitorComponent = (extended_promotional: unknown) =>
  ({
    lcsc: 123456,
    mfr: "TEST-CAP-10U",
    description: "10uF 50V ceramic capacitor",
    stock: 1000,
    basic: 0,
    preferred: 0,
    extended_promotional,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.012 }]),
    package: "0603",
    extra: JSON.stringify({
      attributes: {
        Capacitance: "10uF",
        Tolerance: "±10%",
        "Rated Voltage": "50V",
      },
    }),
  }) as any

test("capacitor maps extended_promotional=1 to is_extended_promotional=true", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeCapacitorComponent(1)])
  expect(cap).not.toBeNull()
  expect(cap!.is_extended_promotional).toBe(true)
})

test("capacitor maps extended_promotional=0 to is_extended_promotional=false", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeCapacitorComponent(0)])
  expect(cap).not.toBeNull()
  expect(cap!.is_extended_promotional).toBe(false)
})

test("capacitor treats null/missing extended_promotional as false", () => {
  const [capNull] = capacitorTableSpec.mapToTable([
    makeCapacitorComponent(null),
  ])
  expect(capNull!.is_extended_promotional).toBe(false)

  const missing = makeCapacitorComponent(0)
  delete missing.extended_promotional
  const [capMissing] = capacitorTableSpec.mapToTable([missing])
  expect(capMissing!.is_extended_promotional).toBe(false)
})

test("mapBleFields maps extended_promotional (component-style mapping path)", () => {
  const base = {
    lcsc: 999,
    mfr: "BLE-TEST",
    description: "BLE module",
    stock: 50,
    basic: 0,
    preferred: 0,
    package: "SMD",
  }
  expect(
    mapBleFields({ ...base, extended_promotional: 1 }, {} as any)
      .is_extended_promotional,
  ).toBe(true)
  expect(
    mapBleFields({ ...base, extended_promotional: 0 }, {} as any)
      .is_extended_promotional,
  ).toBe(false)
})

test("every derived table declares the is_extended_promotional column", () => {
  expect(DERIVED_TABLES.length).toBeGreaterThan(40)
  const missing = DERIVED_TABLES.filter(
    (spec) =>
      !spec.extraColumns.some((col) => col.name === "is_extended_promotional"),
  ).map((spec) => spec.tableName)
  expect(missing).toEqual([])
})

test("every derived table declares the column as boolean type", () => {
  for (const spec of DERIVED_TABLES) {
    const col = spec.extraColumns.find(
      (c) => c.name === "is_extended_promotional",
    )
    expect(col, `table ${spec.tableName}`).toBeDefined()
    expect(col!.type).toBe("boolean")
  }
})
