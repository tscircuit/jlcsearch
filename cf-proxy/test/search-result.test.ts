import { describe, expect, it } from "vitest"
import {
  getPcbaType,
  serializeSearchResult,
  type SearchRow,
} from "../src/search"

describe("serializeSearchResult", () => {
  it("serializes the source-backed PCBA type", () => {
    const row: SearchRow = {
      lcsc: 12345,
      mfr: "HDMI-19P",
      package: "SMD",
      description: "HDMI connector",
      stock: 250,
      price: "1-9:1.25,10-:0.75",
      price1: 1.25,
      basic: 1,
      preferred: 1,
      component_product_type: 0,
      category: "Connectors",
      subcategory: "HDMI Connectors",
    }

    expect(serializeSearchResult(row)).toEqual({
      lcsc: 12345,
      mfr: "HDMI-19P",
      package: "SMD",
      is_basic: true,
      is_preferred: true,
      pcba_type: "Economic and Standard",
      description: "HDMI connector",
      stock: 250,
      price: 1.25,
    })
  })

  it("maps every JLCPCB product type and preserves missing values", () => {
    expect(getPcbaType(0)).toBe("Economic and Standard")
    expect(getPcbaType(1)).toBe("Economic Only")
    expect(getPcbaType(2)).toBe("Standard Only")
    expect(getPcbaType(3)).toBeNull()

    const row: SearchRow = {
      lcsc: 54321,
      mfr: "LEGACY",
      package: "",
      description: null,
      stock: 1,
      price: null,
      price1: null,
      basic: 0,
      preferred: 0,
      component_product_type: null,
      category: null,
      subcategory: null,
    }

    const serializedComponent = serializeSearchResult(row)

    expect(serializedComponent.pcba_type).toBeNull()
  })
})
