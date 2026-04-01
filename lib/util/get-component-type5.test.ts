import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("numeric 1 (extended) returns is_extended=true", () => {
  const result = getComponentTypeFlags(1)
  expect(result.is_base).toBe(false)
  expect(result.is_extended).toBe(true)
  expect(result.is_extended_promotional).toBe(false)
})
