import { expect, test } from "bun:test"
import { Table, getColumnLabel } from "lib/ui/Table"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

test("formats table headers with capitalization and units", () => {
  expect(getColumnLabel("lcsc")).toBe("LCSC")
  expect(getColumnLabel("mfr")).toBe("MFR")
  expect(getColumnLabel("current_rating_a")).toBe("Current (A)")
  expect(getColumnLabel("pitch_mm")).toBe("Pitch (mm)")
  expect(getColumnLabel("gate_threshold_voltage")).toBe(
    "Gate Threshold Voltage",
  )
})

test("renders formatted column labels in table headers", () => {
  const html = renderToStaticMarkup(
    <Table
      rows={[
        {
          lcsc: 123,
          mfr: "ACME",
          current_rating_a: 2,
          pitch_mm: 2.54,
        },
      ]}
    />,
  )

  expect(html).toContain(">LCSC<")
  expect(html).toContain(">MFR<")
  expect(html).toContain(">Current (A)<")
  expect(html).toContain(">Pitch (mm)<")
  expect(html).not.toContain(">current_rating_a<")
})
