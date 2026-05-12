import { describe, expect, it } from "vitest"
import {
  isEnabledQueryParam,
  isExtendedPromotionalPart,
  isTruthyPartFlag,
} from "../src/part-flags"

describe("part flag helpers", () => {
  it("normalizes data-source truthy flags", () => {
    expect(isTruthyPartFlag(true)).toBe(true)
    expect(isTruthyPartFlag(1)).toBe(true)
    expect(isTruthyPartFlag("1")).toBe(true)
    expect(isTruthyPartFlag("true")).toBe(true)
    expect(isTruthyPartFlag(false)).toBe(false)
    expect(isTruthyPartFlag(0)).toBe(false)
    expect(isTruthyPartFlag("0")).toBe(false)
  })

  it("normalizes checkbox query parameters", () => {
    expect(isEnabledQueryParam("true")).toBe(true)
    expect(isEnabledQueryParam("1")).toBe(true)
    expect(isEnabledQueryParam("false")).toBe(false)
    expect(isEnabledQueryParam("0")).toBe(false)
    expect(isEnabledQueryParam(undefined)).toBe(false)
  })

  it("requires preferred without basic for extended promotional parts", () => {
    expect(isExtendedPromotionalPart(1, 0)).toBe(true)
    expect(isExtendedPromotionalPart("1", "0")).toBe(true)
    expect(isExtendedPromotionalPart(true, false)).toBe(true)
    expect(isExtendedPromotionalPart(1, 1)).toBe(false)
    expect(isExtendedPromotionalPart(0, 0)).toBe(false)
  })
})
