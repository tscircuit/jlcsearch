import { expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/is-extended-promotional"

test("isExtendedPromotional derives the flag from preferred non-basic parts", () => {
  expect(isExtendedPromotional({ preferred: 1, basic: 0 })).toBe(true)
  expect(isExtendedPromotional({ preferred: 1, basic: 1 })).toBe(false)
  expect(isExtendedPromotional({ preferred: 0, basic: 0 })).toBe(false)
})
