import { describe, expect, test } from "bun:test"
import { isExtendedPromotionalPart } from "lib/util/is-extended-promotional"

describe("isExtendedPromotionalPart", () => {
  test("treats preferred non-basic components as extended promotional", () => {
    expect(isExtendedPromotionalPart({ preferred: 1, basic: 0 })).toBe(true)
  })

  test("does not treat basic preferred components as extended promotional", () => {
    expect(isExtendedPromotionalPart({ preferred: 1, basic: 1 })).toBe(false)
  })

  test("accepts response field names and string boolean values", () => {
    expect(
      isExtendedPromotionalPart({ is_preferred: "true", is_basic: "false" }),
    ).toBe(true)
  })
})
