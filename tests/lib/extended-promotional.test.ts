import { expect, test } from "bun:test"
import {
  isExtendedPromotional,
  parseBooleanFilter,
} from "lib/util/extended-promotional"

test("detects extended promotional parts from preferred and basic flags", () => {
  expect(isExtendedPromotional({ preferred: 1, basic: 0 })).toBe(true)
  expect(isExtendedPromotional({ preferred: true, basic: false })).toBe(true)
  expect(isExtendedPromotional({ preferred: 1, basic: 1 })).toBe(false)
  expect(isExtendedPromotional({ preferred: 0, basic: 0 })).toBe(false)
})

test("parses true and false extended promotional filters", () => {
  expect(parseBooleanFilter("true")).toBe(true)
  expect(parseBooleanFilter("1")).toBe(true)
  expect(parseBooleanFilter("false")).toBe(false)
  expect(parseBooleanFilter("0")).toBe(false)
  expect(parseBooleanFilter(undefined)).toBeUndefined()
  expect(parseBooleanFilter("maybe")).toBeUndefined()
})
