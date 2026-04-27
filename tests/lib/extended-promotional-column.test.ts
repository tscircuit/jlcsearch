import { expect, test } from "bun:test"
import { rebuildViewWithExtendedPromotional } from "lib/db/optimizations/component-extended-promotional-column"
import { resistorTableSpec } from "lib/db/derivedtables/resistor"

test("rebuildViewWithExtendedPromotional injects column after `components.preferred AS preferred`", () => {
  const original = `CREATE VIEW v_components AS SELECT components.basic, components.preferred AS preferred, components.lcsc FROM components`
  const rebuilt = rebuildViewWithExtendedPromotional(original)
  expect(rebuilt).toContain("components.is_extended_promotional")
  expect(rebuilt.indexOf("components.preferred AS preferred")).toBeLessThan(
    rebuilt.indexOf("components.is_extended_promotional"),
  )
})

test("rebuildViewWithExtendedPromotional handles bare `components.preferred` reference", () => {
  const original = `CREATE VIEW v_components AS SELECT components.preferred, components.lcsc FROM components`
  const rebuilt = rebuildViewWithExtendedPromotional(original)
  expect(rebuilt).toContain("components.is_extended_promotional")
})

test("rebuildViewWithExtendedPromotional returns input unchanged when pattern is missing", () => {
  const original = `CREATE VIEW v_components AS SELECT components.lcsc FROM components`
  const rebuilt = rebuildViewWithExtendedPromotional(original)
  expect(rebuilt).toBe(original)
})

test("resistor mapToTable derives is_extended_promotional from upstream column", () => {
  const promotionalComponent = {
    lcsc: 1,
    mfr: "RES-EP",
    description: "10k 0603 resistor",
    stock: 100,
    basic: 0,
    preferred: 1,
    is_extended_promotional: 1,
    package: "0603",
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.001 }]),
    extra: JSON.stringify({
      attributes: {
        Resistance: "10k",
        Tolerance: "1%",
        "Power(Watts)": "0.1W",
      },
    }),
  } as any

  const [resistor] = resistorTableSpec.mapToTable([promotionalComponent])

  expect(resistor?.is_extended_promotional).toBe(true)
  expect(resistor?.is_basic).toBe(false)
  expect(resistor?.is_preferred).toBe(true)
})

test("resistor mapToTable returns is_extended_promotional=false when upstream column is 0", () => {
  const basicComponent = {
    lcsc: 2,
    mfr: "RES-BASIC",
    description: "10k 0603 resistor",
    stock: 100,
    basic: 1,
    preferred: 0,
    is_extended_promotional: 0,
    package: "0603",
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.001 }]),
    extra: JSON.stringify({
      attributes: {
        Resistance: "10k",
        Tolerance: "1%",
        "Power(Watts)": "0.1W",
      },
    }),
  } as any

  const [resistor] = resistorTableSpec.mapToTable([basicComponent])

  expect(resistor?.is_extended_promotional).toBe(false)
  expect(resistor?.is_basic).toBe(true)
})
