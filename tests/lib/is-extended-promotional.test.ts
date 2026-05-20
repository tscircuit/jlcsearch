import { expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/is-extended-promotional"

test("isExtendedPromotional derives extended promotional from preferred but not basic", () => {
  expect(isExtendedPromotional({ preferred: 1, basic: 0 })).toBe(true)
  expect(isExtendedPromotional({ preferred: 1, basic: 1 })).toBe(false)
  expect(isExtendedPromotional({ preferred: 0, basic: 0 })).toBe(false)
  expect(isExtendedPromotional({ preferred: 1, basic: null })).toBe(false)
  expect(isExtendedPromotional({ preferred: true, basic: false })).toBe(false)
  expect(isExtendedPromotional({ preferred: null, basic: null })).toBe(false)
})
