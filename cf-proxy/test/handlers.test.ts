import { describe, expect, it } from "vitest"
import { ROUTE_TO_TABLE, TABLE_CONFIGS } from "../src/handlers"

describe("D1 handler route config", () => {
  it("maps pinheaders to the existing header table", () => {
    expect(ROUTE_TO_TABLE["/pinheaders/list"]).toBe("header")
  })

  it("supports sourcing-friendly header filter aliases", () => {
    expect(TABLE_CONFIGS.header.filters.pitch_mm).toEqual({
      field: "pitch_mm",
      type: "number",
    })
    expect(TABLE_CONFIGS.header.filters.pin_count).toEqual({
      field: "num_pins",
      type: "number",
    })
    expect(TABLE_CONFIGS.header.filters.num_rows).toEqual({
      field: "num_rows",
      type: "number",
    })
    expect(TABLE_CONFIGS.header.filters.num_pins_per_row).toEqual({
      field: "num_pins_per_row",
      type: "number",
    })
  })
})
