import { describe, expect, test } from "bun:test"
import { formatSiUnit } from "lib/util/format-si-unit"

describe("formatSiUnit", () => {
  test.each([
    [null, ""],
    [undefined, ""],
    [0, "0"],
    [1, "1"],
    [1_000, "1k"],
    [1_000_000, "1M"],
    [4_700, "4.70k"],
    [0.1, "100m"],
    [0.0000047, "4.70µ"],
  ])("formats %p as %p", (input, expected) => {
    expect(formatSiUnit(input as number | null | undefined)).toBe(expected)
  })

  // Rounding to 3 significant figures used to push the scaled value up to the next
  // prefix and fall out as exponential notation (e.g. "1.00e+3k"). The formatter must
  // step up a prefix instead so the reading stays human ("1M", "1G", "1m").
  test.each([
    [999_999, "1M"],
    [999_999_999, "1G"],
    [999_500, "1M"],
    [0.0009999, "1m"],
    [-999_999, "-1M"],
  ])("keeps %p out of exponential notation as %p", (input, expected) => {
    const out = formatSiUnit(input)
    expect(out).not.toContain("e")
    expect(out).toBe(expected)
  })
})
