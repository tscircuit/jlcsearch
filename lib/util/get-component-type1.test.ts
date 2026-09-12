import { test, expect } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("base parts return is_base=true and is_extended=false", () => {
  const result = getComponentTypeFlags("base")
  expect(result.is_base).toBe(true)
  expect(result.is_extended).toBe(false)
  expect(result.is_extended_promotional).toBe(false)
})
