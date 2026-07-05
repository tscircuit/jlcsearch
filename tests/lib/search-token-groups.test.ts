import { expect, test } from "bun:test"
import { buildSearchTokenGroups } from "lib/util/search-token-groups"

test("search token groups map barrel jack wording to DC power connector terms", () => {
  expect(buildSearchTokenGroups("barrel jack")).toEqual([
    ["dc"],
    ["power"],
    ["receptacle"],
  ])
})

test("search token groups drop nominal voltage tokens for barrel jack searches", () => {
  expect(buildSearchTokenGroups("5v barrel jack")).toEqual([
    ["dc"],
    ["power"],
    ["receptacle"],
  ])
})

test("search token groups preserve non-barrel-jack terms", () => {
  expect(buildSearchTokenGroups("2.1mm barrel jack")).toEqual([
    ["2"],
    ["1mm"],
    ["dc"],
    ["power"],
    ["receptacle"],
  ])
})
