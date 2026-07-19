import { expect, test } from "bun:test"
import { capacitorTableSpec } from "lib/db/derivedtables/capacitor"

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 123,
    mfr: "TEST-CAP",
    description: "ceramic capacitor",
    stock: 100,
    basic: 0,
    preferred: 0,
    flag: 0,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.1 }]),
    package: "0402",
    extra: JSON.stringify({
      attributes: {
        Capacitance: "100nF",
        Tolerance: "±5%",
        "Rated Voltage": "16V",
      },
    }),
    ...overrides,
  }) as any

test("capacitor table maps flag=3 to is_extended_promotional=true", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeComponent({ flag: 3 })])
  expect(cap?.is_extended_promotional).toBe(true)
})

test("capacitor table maps flag=0 to is_extended_promotional=false", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeComponent({ flag: 0 })])
  expect(cap?.is_extended_promotional).toBe(false)
})

test("capacitor table maps flag=1 to is_extended_promotional=false (basic)", () => {
  const [cap] = capacitorTableSpec.mapToTable([makeComponent({ flag: 1, basic: 1 })])
  expect(cap?.is_extended_promotional).toBe(false)
  expect(cap?.is_basic).toBe(true)
})
