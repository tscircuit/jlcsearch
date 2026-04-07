import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("'BASE' (uppercase) is treated the same as 'base'", () => {
  const result = getComponentTypeFlags("BASE")
  expect(result.is_base).toBe(true)
  expect(result.is_extended).toBe(false)
  expect(result.is_extended_promotional).toBe(false)
})
