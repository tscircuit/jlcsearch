import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("numeric 0 (base) returns is_base=true", () => {
  const result = getComponentTypeFlags(0)
  expect(result.is_base).toBe(true)
  expect(result.is_extended).toBe(false)
  expect(result.is_extended_promotional).toBe(false)
})
