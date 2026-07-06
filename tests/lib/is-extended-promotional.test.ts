import { expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/is-extended-promotional"

test("isExtendedPromotional uses explicit JLC library metadata", () => {
  expect(
    isExtendedPromotional({
      basic: 1,
      preferred: 0,
      extra: JSON.stringify({ componentLibraryType: "expandPrefer" }),
    }),
  ).toBe(true)
})

test("isExtendedPromotional falls back to preferred non-basic parts", () => {
  expect(isExtendedPromotional({ basic: 0, preferred: 1 })).toBe(true)
  expect(isExtendedPromotional({ basic: 1, preferred: 1 })).toBe(false)
  expect(isExtendedPromotional({ basic: 0, preferred: 0 })).toBe(false)
})
