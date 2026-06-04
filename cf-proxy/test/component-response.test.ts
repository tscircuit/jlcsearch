import { describe, expect, it } from "vitest"
import { mapD1CatalogComponent, mapD1SearchComponent } from "../src/index"

describe("D1 component response mapping", () => {
  it("includes is_extended_promotional in /api/search components", () => {
    const component = mapD1SearchComponent({
      lcsc: 7420372,
      mfr: "H5VL10B",
      package: "DFN1006-2L",
      description: "Test component",
      stock: 100,
      price1: 0.001,
      basic: 0,
      preferred: 1,
    })

    expect(component).toMatchObject({
      lcsc: 7420372,
      mfr: "H5VL10B",
      package: "DFN1006-2L",
      description: "Test component",
      stock: 100,
      price: 0.001,
      is_basic: false,
      is_preferred: true,
      is_extended_promotional: true,
    })
  })

  it("includes is_extended_promotional in /components/list components", () => {
    const component = mapD1CatalogComponent({
      lcsc: 7420372,
      mfr: "H5VL10B",
      package: "DFN1006-2L",
      description: "Test component",
      stock: 100,
      price: "[]",
      category: "Discrete Semiconductor",
      subcategory: "Diodes",
      basic: 0,
      preferred: 1,
    })

    expect(component).toMatchObject({
      lcsc: 7420372,
      category: "Discrete Semiconductor",
      subcategory: "Diodes",
      is_basic: false,
      is_preferred: true,
      is_extended_promotional: true,
    })
  })

  it("defaults missing promotional source flags to false", () => {
    expect(
      mapD1SearchComponent({
        lcsc: 1,
        mfr: "MFR",
      }).is_extended_promotional,
    ).toBe(false)
  })
})
