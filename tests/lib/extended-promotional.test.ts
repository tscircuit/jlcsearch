import { expect, test } from "bun:test"
import { getIsExtendedPromotional } from "lib/util/extended-promotional"

test("getIsExtendedPromotional falls back to preferred non-basic parts", () => {
  expect(getIsExtendedPromotional({ preferred: 1, basic: 0 })).toBe(true)
  expect(getIsExtendedPromotional({ preferred: 1, basic: 1 })).toBe(false)
  expect(getIsExtendedPromotional({ preferred: 0, basic: 0 })).toBe(false)
})

test("getIsExtendedPromotional reads explicit metadata from extra", () => {
  expect(
    getIsExtendedPromotional({
      preferred: 0,
      basic: 0,
      extra: JSON.stringify({ is_extended_promotional: true }),
    }),
  ).toBe(true)

  expect(
    getIsExtendedPromotional({
      preferred: 1,
      basic: 0,
      extra: JSON.stringify({ attributes: { extendedPromotional: false } }),
    }),
  ).toBe(false)
})
