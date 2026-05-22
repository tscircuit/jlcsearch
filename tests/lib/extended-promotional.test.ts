import { expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/extended-promotional"

test("extended promotional parts are preferred but not basic", () => {
  expect(isExtendedPromotional({ preferred: 1, basic: 0 })).toBe(true)
  expect(isExtendedPromotional({ preferred: true, basic: false })).toBe(true)
  expect(isExtendedPromotional({ is_preferred: "true", is_basic: "0" })).toBe(
    true,
  )
})

test("basic or non-preferred parts are not extended promotional", () => {
  expect(isExtendedPromotional({ preferred: 1, basic: 1 })).toBe(false)
  expect(isExtendedPromotional({ preferred: 0, basic: 0 })).toBe(false)
  expect(isExtendedPromotional({ preferred: "0", basic: "0" })).toBe(false)
})
