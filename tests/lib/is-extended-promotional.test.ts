import { expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/is-extended-promotional"

test("isExtendedPromotional derives preferred non-basic components", () => {
  expect(isExtendedPromotional({ preferred: 1, basic: 0 })).toBe(true)
  expect(isExtendedPromotional({ preferred: true, basic: false })).toBe(true)
  expect(isExtendedPromotional({ preferred: 1, basic: null })).toBe(true)

  expect(isExtendedPromotional({ preferred: 1, basic: 1 })).toBe(false)
  expect(isExtendedPromotional({ preferred: 0, basic: 0 })).toBe(false)
  expect(isExtendedPromotional({ preferred: null, basic: 0 })).toBe(false)
})
