import { expect, test } from "bun:test"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"

const makeResistorComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 12345,
    mfr: "TEST-RES",
    description: "100Ω Resistor",
    stock: 1000,
    basic: 0,
    preferred: 0,
    extended_promotional: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.01 }]),
    package: "0402",
    extra: JSON.stringify({
      attributes: {
        Resistance: "100Ω",
        Tolerance: "1%",
        "Power(Watts)": "0.1W",
      },
    }),
    ...overrides,
  }) as any

const makeCapacitorComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 67890,
    mfr: "TEST-CAP",
    description: "100nF Capacitor",
    stock: 500,
    basic: 0,
    preferred: 0,
    extended_promotional: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.02 }]),
    package: "0402",
    extra: JSON.stringify({
      attributes: {
        Capacitance: "100nF",
        Tolerance: "10%",
        "Voltage Rated": "10V",
      },
    }),
    ...overrides,
  }) as any

test("resistor mapToTable includes is_extended_promotional field", () => {
  const [resistor] = resistorTableSpec.mapToTable([makeResistorComponent()])

  expect(resistor).not.toBeNull()
  expect(resistor).toHaveProperty("is_extended_promotional")
})

test("resistor is_extended_promotional is false when extended_promotional = 0", () => {
  const [resistor] = resistorTableSpec.mapToTable([
    makeResistorComponent({ extended_promotional: 0 }),
  ])

  expect(resistor?.is_extended_promotional).toBe(false)
})

test("resistor is_extended_promotional is true when extended_promotional = 1", () => {
  const [resistor] = resistorTableSpec.mapToTable([
    makeResistorComponent({ extended_promotional: 1 }),
  ])

  expect(resistor?.is_extended_promotional).toBe(true)
})

test("resistor is_extended_promotional is independent of is_basic", () => {
  // A component can be extended_promotional without being basic
  const [resistor] = resistorTableSpec.mapToTable([
    makeResistorComponent({ extended_promotional: 1, basic: 0 }),
  ])

  expect(resistor?.is_extended_promotional).toBe(true)
  expect(resistor?.is_basic).toBe(false)
})

test("capacitor mapToTable includes is_extended_promotional field", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeCapacitorComponent()])

  expect(cap).not.toBeNull()
  expect(cap).toHaveProperty("is_extended_promotional")
})

test("capacitor is_extended_promotional is true when extended_promotional = 1", () => {
  const [cap] = capacitorTableSpec.mapToTable([
    makeCapacitorComponent({ extended_promotional: 1 }),
  ])

  expect(cap?.is_extended_promotional).toBe(true)
})
