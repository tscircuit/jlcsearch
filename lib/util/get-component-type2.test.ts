import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("extended parts return is_base=false and is_extended=true", () => {
  const result = getComponentTypeFlags("extended")
  expect(result.is_base).toBe(false)
  expect(result.is_extended).toBe(true)
  expect(result.is_extended_promotional).toBe(false)
})
