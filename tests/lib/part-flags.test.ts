import { expect, test } from "bun:test"
import {
  isExtendedPromotionalPart,
  isTruthyPartFlag,
} from "lib/util/part-flags"

test("isTruthyPartFlag accepts boolean, numeric, and string truthy flags", () => {
  expect(isTruthyPartFlag(true)).toBe(true)
  expect(isTruthyPartFlag(1)).toBe(true)
  expect(isTruthyPartFlag("1")).toBe(true)
  expect(isTruthyPartFlag("true")).toBe(true)
  expect(isTruthyPartFlag(false)).toBe(false)
  expect(isTruthyPartFlag(0)).toBe(false)
  expect(isTruthyPartFlag("0")).toBe(false)
})

test("isExtendedPromotionalPart requires preferred without basic", () => {
  expect(isExtendedPromotionalPart(1, 0)).toBe(true)
  expect(isExtendedPromotionalPart("1", "0")).toBe(true)
  expect(isExtendedPromotionalPart(true, false)).toBe(true)
  expect(isExtendedPromotionalPart(1, 1)).toBe(false)
  expect(isExtendedPromotionalPart(0, 0)).toBe(false)
})
