import { expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/is-extended-promotional"

test("detects preferred non-basic components", () => {
  expect(isExtendedPromotional(0, 1)).toBe(true)
  expect(isExtendedPromotional(false, true)).toBe(true)
  expect(isExtendedPromotional("false", "yes")).toBe(true)
})

test("ignores regular basic or non-preferred components", () => {
  expect(isExtendedPromotional(1, 1)).toBe(false)
  expect(isExtendedPromotional(0, 0)).toBe(false)
  expect(isExtendedPromotional("true", "true")).toBe(false)
})
