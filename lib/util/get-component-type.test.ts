import { expect, test } from "bun:test"
import { getComponentTypeFlags } from "./get-component-type"

test("base → is_basic", () => {
  expect(getComponentTypeFlags("base")).toEqual({
    is_basic: 1,
    is_preferred: 0,
    is_extended_promotional: 0,
  })
})

test("expand → is_preferred", () => {
  expect(getComponentTypeFlags("expand")).toEqual({
    is_basic: 0,
    is_preferred: 1,
    is_extended_promotional: 0,
  })
})

test("extend → all false", () => {
  expect(getComponentTypeFlags("extend")).toEqual({
    is_basic: 0,
    is_preferred: 0,
    is_extended_promotional: 0,
  })
})

test("promotion → is_extended_promotional", () => {
  expect(getComponentTypeFlags("promotion")).toEqual({
    is_basic: 0,
    is_preferred: 0,
    is_extended_promotional: 1,
  })
})

test("promotionextend → is_extended_promotional", () => {
  expect(getComponentTypeFlags("promotionextend")).toEqual({
    is_basic: 0,
    is_preferred: 0,
    is_extended_promotional: 1,
  })
})

test("numeric 0 → is_basic", () => {
  expect(getComponentTypeFlags(0)).toEqual({
    is_basic: 1,
    is_preferred: 0,
    is_extended_promotional: 0,
  })
})

test("numeric 1 → is_preferred", () => {
  expect(getComponentTypeFlags(1)).toEqual({
    is_basic: 0,
    is_preferred: 1,
    is_extended_promotional: 0,
  })
})

test("numeric 3 → is_extended_promotional", () => {
  expect(getComponentTypeFlags(3)).toEqual({
    is_basic: 0,
    is_preferred: 0,
    is_extended_promotional: 1,
  })
})

test("null → all false", () => {
  expect(getComponentTypeFlags(null)).toEqual({
    is_basic: 0,
    is_preferred: 0,
    is_extended_promotional: 0,
  })
})

test("undefined → all false", () => {
  expect(getComponentTypeFlags(undefined)).toEqual({
    is_basic: 0,
    is_preferred: 0,
    is_extended_promotional: 0,
  })
})

test("case insensitive", () => {
  expect(getComponentTypeFlags("PROMOTION")).toEqual({
    is_basic: 0,
    is_preferred: 0,
    is_extended_promotional: 1,
  })
  expect(getComponentTypeFlags("Base")).toEqual({
    is_basic: 1,
    is_preferred: 0,
    is_extended_promotional: 0,
  })
})
