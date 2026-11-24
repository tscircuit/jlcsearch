import { expect, test } from "bun:test"
import type { BaseComponent } from "lib/db/derivedtables/component-base"
import {
  BASE_COMPONENT_COLUMNS,
  DERIVED_TABLES,
} from "lib/db/derivedtables/setup-derived-tables"

test("BASE_COMPONENT_COLUMNS includes all shared BaseComponent columns", () => {
  const columnNames = BASE_COMPONENT_COLUMNS.map((col) => col.name)
  expect(columnNames).toEqual([
    "lcsc",
    "mfr",
    "description",
    "stock",
    "price1",
    "in_stock",
    "is_basic",
    "is_preferred",
  ])

  // Compile-time check that BaseComponent carries every shared column + attributes
  const sample: BaseComponent = {
    lcsc: 12345,
    mfr: "RC0402FR-0710KL",
    description: "10kOhm 0402 Resistor",
    stock: 1000,
    price1: 0.002,
    in_stock: true,
    is_basic: true,
    is_preferred: false,
    attributes: {},
  }
  expect(sample.is_basic).toBe(true)
  expect(sample.is_preferred).toBe(false)
})

test("all derived tables are registered and share unique table names", () => {
  expect(DERIVED_TABLES.length).toBeGreaterThan(40)
  const names = DERIVED_TABLES.map((t) => t.tableName)
  expect(new Set(names).size).toBe(names.length)
})
