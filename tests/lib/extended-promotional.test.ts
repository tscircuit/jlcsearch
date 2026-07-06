import { expect, test } from "bun:test"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"

const makeResistor = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 100,
    mfr: "TEST-RES",
    description: "10kΩ Resistor",
    stock: 1000,
    basic: 0,
    preferred: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.01 }]),
    package: "0402",
    extra: JSON.stringify({
      attributes: {
        Resistance: "10kΩ",
        Tolerance: "±1%",
        "Power(Watts)": "0.1W",
      },
    }),
    ...overrides,
  }) as any

const makeCapacitor = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 200,
    mfr: "TEST-CAP",
    description: "100nF Ceramic Capacitor",
    stock: 5000,
    basic: 0,
    preferred: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.005 }]),
    package: "0402",
    extra: JSON.stringify({
      attributes: {
        Capacitance: "100nF",
        Tolerance: "±10%",
        "Rated Voltage": "50V",
      },
    }),
    ...overrides,
  }) as any

test("resistor with basic=0 has is_extended_promotional=false", () => {
  const [resistor] = resistorTableSpec.mapToTable([makeResistor({ basic: 0 })])
  expect(resistor?.is_extended_promotional).toBe(false)
})

test("resistor with basic=1 has is_extended_promotional=false", () => {
  const [resistor] = resistorTableSpec.mapToTable([makeResistor({ basic: 1 })])
  expect(resistor?.is_extended_promotional).toBe(false)
})

test("resistor with basic=2 has is_extended_promotional=true", () => {
  const [resistor] = resistorTableSpec.mapToTable([makeResistor({ basic: 2 })])
  expect(resistor?.is_extended_promotional).toBe(true)
})

test("resistor with basic=2 still has is_basic=true (acts as basic)", () => {
  const [resistor] = resistorTableSpec.mapToTable([makeResistor({ basic: 2 })])
  expect(resistor?.is_basic).toBe(true)
})

test("resistor with basic=1 has is_basic=true and is_extended_promotional=false", () => {
  const [resistor] = resistorTableSpec.mapToTable([makeResistor({ basic: 1 })])
  expect(resistor?.is_basic).toBe(true)
  expect(resistor?.is_extended_promotional).toBe(false)
})

test("capacitor with basic=0 has is_extended_promotional=false", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeCapacitor({ basic: 0 })])
  expect(cap?.is_extended_promotional).toBe(false)
})

test("capacitor with basic=2 has is_extended_promotional=true", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeCapacitor({ basic: 2 })])
  expect(cap?.is_extended_promotional).toBe(true)
})

test("capacitor with basic=2 still has is_basic=true (acts as basic)", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeCapacitor({ basic: 2 })])
  expect(cap?.is_basic).toBe(true)
})
