import { expect, test } from "bun:test"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"

const makeResistor = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 1001,
    mfr: "TEST-RES",
    description: "100Ω 1% 0.1W 0603",
    stock: 100,
    basic: 0,
    preferred: 0,
    extended_promotional: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.01 }]),
    package: "0603",
    extra: JSON.stringify({
      attributes: {
        Resistance: "100Ω",
        Tolerance: "±1%",
        "Power(Watts)": "0.1W",
      },
    }),
    ...overrides,
  }) as any

const makeCapacitor = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 2001,
    mfr: "TEST-CAP",
    description: "100nF 10% 10V 0402 Ceramic Capacitors",
    stock: 100,
    basic: 0,
    preferred: 0,
    extended_promotional: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.01 }]),
    package: "0402",
    extra: JSON.stringify({
      attributes: {
        Capacitance: "100nF",
        Tolerance: "±10%",
        "Rated Voltage": "10V",
        "Temperature Coefficient": "X5R",
      },
    }),
    ...overrides,
  }) as any

test("resistor mapToTable sets is_extended_promotional to false when extended_promotional is 0", () => {
  const [resistor] = resistorTableSpec.mapToTable([makeResistor()])
  expect(resistor?.is_extended_promotional).toBe(false)
})

test("resistor mapToTable sets is_extended_promotional to true when extended_promotional is 1", () => {
  const [resistor] = resistorTableSpec.mapToTable([
    makeResistor({ extended_promotional: 1 }),
  ])
  expect(resistor?.is_extended_promotional).toBe(true)
})

test("resistor extraColumns includes is_extended_promotional", () => {
  const colNames = resistorTableSpec.extraColumns.map((c) => c.name)
  expect(colNames).toContain("is_extended_promotional")
})

test("capacitor mapToTable sets is_extended_promotional to false when extended_promotional is 0", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeCapacitor()])
  expect(cap?.is_extended_promotional).toBe(false)
})

test("capacitor mapToTable sets is_extended_promotional to true when extended_promotional is 1", () => {
  const [cap] = capacitorTableSpec.mapToTable([
    makeCapacitor({ extended_promotional: 1 }),
  ])
  expect(cap?.is_extended_promotional).toBe(true)
})

test("capacitor extraColumns includes is_extended_promotional", () => {
  const colNames = capacitorTableSpec.extraColumns.map((c) => c.name)
  expect(colNames).toContain("is_extended_promotional")
})
