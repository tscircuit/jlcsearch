import { describe, expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/is-extended-promotional"

describe("isExtendedPromotional", () => {
  test("true when preferred and not basic (number flags)", () => {
    expect(isExtendedPromotional(0, 1)).toBe(true)
  })

  test("false when basic even if preferred", () => {
    expect(isExtendedPromotional(1, 1)).toBe(false)
  })

  test("false when neither preferred nor basic", () => {
    expect(isExtendedPromotional(0, 0)).toBe(false)
  })

  test("false when basic only", () => {
    expect(isExtendedPromotional(1, 0)).toBe(false)
  })

  test("treats boolean inputs the same as 0/1", () => {
    expect(isExtendedPromotional(false, true)).toBe(true)
    expect(isExtendedPromotional(true, true)).toBe(false)
  })

  test("null/undefined preferred is not extended promotional", () => {
    expect(isExtendedPromotional(0, null)).toBe(false)
    expect(isExtendedPromotional(0, undefined)).toBe(false)
    expect(isExtendedPromotional(null, null)).toBe(false)
  })
})
