import { describe, expect, it } from "vitest"
import { isExtendedPromotionalMetadata } from "../src/extended-promotional"

describe("isExtendedPromotionalMetadata", () => {
  it("detects extended promotional library type variants", () => {
    expect(
      isExtendedPromotionalMetadata({ libraryType: "Extended Promotional" }),
    ).toBe(true)
    expect(
      isExtendedPromotionalMetadata({ library_type: "extended_promo" }),
    ).toBe(true)
    expect(
      isExtendedPromotionalMetadata({ libraryType: "extended-promo" }),
    ).toBe(true)
  })

  it("detects boolean-style extended promotional metadata", () => {
    expect(isExtendedPromotionalMetadata({ extendedPromotional: true })).toBe(
      true,
    )
    expect(
      isExtendedPromotionalMetadata({ isExtendedPromotional: "yes" }),
    ).toBe(true)
    expect(isExtendedPromotionalMetadata({ extended_promotional: 1 })).toBe(
      true,
    )
    expect(
      isExtendedPromotionalMetadata({ is_extended_promotional: "true" }),
    ).toBe(true)
  })

  it("does not flag normal basic/extended components", () => {
    expect(isExtendedPromotionalMetadata({ libraryType: "basic" })).toBe(false)
    expect(isExtendedPromotionalMetadata({ libraryType: "extended" })).toBe(
      false,
    )
    expect(isExtendedPromotionalMetadata({ extendedPromotional: false })).toBe(
      false,
    )
    expect(isExtendedPromotionalMetadata(null)).toBe(false)
  })
})
