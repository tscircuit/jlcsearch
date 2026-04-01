import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("numeric 2 (extended_promotional) returns is_extended_promotional=true", () => {
  const result = getComponentTypeFlags(2)
  expect(result.is_base).toBe(false)
  expect(result.is_extended).toBe(true)
  expect(result.is_extended_promotional).toBe(true)
})
