import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("null/undefined input returns safe defaults", () => {
  const result = getComponentTypeFlags(null as any)
  expect(result.is_base).toBe(false)
  expect(result.is_extended).toBe(false)
  expect(result.is_extended_promotional).toBe(false)
})
