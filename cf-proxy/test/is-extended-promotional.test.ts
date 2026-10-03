import { describe, expect, it } from "vitest"
import {
  isExtendedPromotional,
  wantsExtendedPromotional,
} from "../src/is-extended-promotional"
import { renderD1TablePage } from "../src/render"

describe("isExtendedPromotional", () => {
  it("is true only for preferred && !basic", () => {
    expect(isExtendedPromotional(0, 1)).toBe(true)
    expect(isExtendedPromotional(1, 1)).toBe(false)
    expect(isExtendedPromotional(0, 0)).toBe(false)
    expect(isExtendedPromotional(1, 0)).toBe(false)
  })

  it("parses filter query values", () => {
    expect(wantsExtendedPromotional("true")).toBe(true)
    expect(wantsExtendedPromotional("1")).toBe(true)
    expect(wantsExtendedPromotional("false")).toBe(false)
    expect(wantsExtendedPromotional(undefined)).toBe(false)
  })
})

describe("components list UI", () => {
  it("exposes Extended Promotional checkbox on /components/list", () => {
    const html = renderD1TablePage(
      "/components/list",
      {
        components: [
          {
            lcsc: 19077510,
            mfr: "SMF15CA",
            package: "SOD-123FL",
            stock: 100,
            price: "1-9:0.02",
            is_basic: false,
            is_preferred: true,
            is_extended_promotional: true,
          },
        ],
      },
      { is_extended_promotional: "true" },
      "https://jlcsearch.tscircuit.com/components/list?is_extended_promotional=true",
    )

    expect(html).toContain('name="is_extended_promotional"')
    expect(html).toContain("Extended Promotional")
    expect(html).toContain("checked")
    expect(html).toContain("SMF15CA")
  })
})
