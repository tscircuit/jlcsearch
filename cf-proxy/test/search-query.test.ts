import { describe, expect, it } from "vitest"
import { validateSearchQuery } from "../src/search"
import { buildSearchTokenGroups } from "../src/search-query"

describe("buildSearchTokenGroups", () => {
  it("maps barrel jack wording to DC power connector catalog terms", () => {
    expect(buildSearchTokenGroups("barrel jack")).toEqual([
      ["dc"],
      ["power"],
      ["receptacle"],
    ])
  })

  it("drops nominal voltage tokens for barrel jack searches", () => {
    expect(buildSearchTokenGroups("5v barrel jack")).toEqual([
      ["dc"],
      ["power"],
      ["receptacle"],
    ])
  })

  it("preserves non-barrel-jack terms", () => {
    expect(buildSearchTokenGroups("2.1mm barrel jack")).toEqual([
      ["2"],
      ["1mm"],
      ["dc"],
      ["power"],
      ["receptacle"],
    ])
  })
})

it("includes a package code exactly once in the text index search", () => {
  const match = validateSearchQuery({ q: "resistor 0805" }).match
  expect(validateSearchQuery({ q: "resistor", package: "0805" }).match).toBe(
    match,
  )
  expect(
    validateSearchQuery({ q: "resistor 0805", package: "0805" }).match,
  ).toBe(match)
})
