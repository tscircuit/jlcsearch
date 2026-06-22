import { expect, test } from "bun:test"
import { parseLcscSearchTerm } from "lib/util/parse-lcsc-search-term"

test("parseLcscSearchTerm accepts numeric and C-prefixed LCSC part numbers", () => {
  expect(parseLcscSearchTerm("1002")).toBe(1002)
  expect(parseLcscSearchTerm("C1002")).toBe(1002)
  expect(parseLcscSearchTerm("c51950748")).toBe(51950748)
  expect(parseLcscSearchTerm(" C51950749 ")).toBe(51950749)
})

test("parseLcscSearchTerm rejects non-LCSC search text", () => {
  expect(parseLcscSearchTerm("USB Type-C 16P")).toBeNull()
  expect(parseLcscSearchTerm("C1002 resistor")).toBeNull()
  expect(parseLcscSearchTerm("")).toBeNull()
})
