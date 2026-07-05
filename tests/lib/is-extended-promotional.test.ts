import { expect, test } from "bun:test"
import { isExtendedPromotional } from "lib/util/is-extended-promotional"

test("flags non-basic parts whose extra data marks them promotional", () => {
  const extra = JSON.stringify({
    attributes: { "Library Type": "Basic/Promotional Extended" },
  })
  expect(isExtendedPromotional(0, extra)).toBe(true)
})

test("does not flag basic parts even if extra mentions promotional", () => {
  const extra = JSON.stringify({
    attributes: { "Library Type": "Basic/Promotional Extended" },
  })
  expect(isExtendedPromotional(1, extra)).toBe(false)
  expect(isExtendedPromotional(true, extra)).toBe(false)
})

test("does not flag ordinary extended parts", () => {
  const extra = JSON.stringify({
    attributes: { "Library Type": "Extended" },
  })
  expect(isExtendedPromotional(0, extra)).toBe(false)
})

test("matches case-insensitively", () => {
  const extra = JSON.stringify({
    attributes: { "Library Type": "basic/PROMOTIONAL extended" },
  })
  expect(isExtendedPromotional(0, extra)).toBe(true)
})

test("handles null / undefined / empty extra safely", () => {
  expect(isExtendedPromotional(0, null)).toBe(false)
  expect(isExtendedPromotional(0, undefined)).toBe(false)
  expect(isExtendedPromotional(0, "")).toBe(false)
  expect(isExtendedPromotional(null, null)).toBe(false)
})
