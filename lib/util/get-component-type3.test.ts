import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("extended_promotional parts return is_extended_promotional=true", () => {
  const result = getComponentTypeFlags("extended_promotional")
  expect(result.is_base).toBe(false)
  expect(result.is_extended).toBe(true)
  expect(result.is_extended_promotional).toBe(true)
})
