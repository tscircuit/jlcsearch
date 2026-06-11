import { describe, expect, it } from "vitest"
import { isExtendedPromotional } from "../src/search"

describe("search helpers", () => {
  it("marks preferred non-basic components as extended promotional", () => {
    expect(isExtendedPromotional({ basic: 0, preferred: 1 })).toBe(true)
    expect(isExtendedPromotional({ basic: false, preferred: true })).toBe(true)
  })

  it("does not mark basic or non-preferred components as extended promotional", () => {
    expect(isExtendedPromotional({ basic: 1, preferred: 1 })).toBe(false)
    expect(isExtendedPromotional({ basic: 0, preferred: 0 })).toBe(false)
    expect(isExtendedPromotional({ basic: null, preferred: null })).toBe(false)
  })
})
