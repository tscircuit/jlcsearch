import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("unknown string value returns safe defaults (is_base=false, is_extended=false)", () => {
  const result = getComponentTypeFlags("unknown_value")
  expect(result.is_base).toBe(false)
  expect(result.is_extended).toBe(false)
  expect(result.is_extended_promotional).toBe(false)
})
