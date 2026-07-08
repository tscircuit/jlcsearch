import { describe, expect, it as vitestIt } from "vitest"
import { fetchJson } from "./cloudflare-http"

type FieldAlias = string | string[]

interface FilterCase {
  param: string
  rowField: string
  pick?: (rows: any[]) => unknown
  serialize?: (value: unknown) => string
  assert: (row: any, value: unknown) => void
}

interface RouteCase {
  name: string
  path: string
  responseKey: string
  requiredFields: FieldAlias[]
  booleanFields?: string[]
  filters?: FilterCase[]
}

const REMOTE_TEST_TIMEOUT_MS = 15_000
const it = (name: string, fn: () => Promise<unknown> | unknown) =>
  vitestIt(name, fn, REMOTE_TEST_TIMEOUT_MS)

const getFieldValue = (row: any, alias: FieldAlias): unknown => {
  if (Array.isArray(alias)) {
    for (const key of alias) {
      if (key in row) return row[key]
    }
    return undefined
  }
  return row[alias]
}

const getFieldLabel = (alias: FieldAlias): string =>
  Array.isArray(alias) ? alias.join(" or ") : alias

const expectRowHasFields = (row: any, fields: FieldAlias[]) => {
  for (const field of fields) {
    expect(
      getFieldValue(row, field),
      `expected row to include ${getFieldLabel(field)}`,
    ).not.toBeUndefined()
  }
}

const stringEquals = (field: string): FilterCase => ({
  param: field,
  rowField: field,
  pick: (rows) =>
    rows.find((row) => typeof row[field] === "string" && row[field]),
  serialize: (value) => String(value),
  assert: (row, value) => {
    expect(row[field]).toBe(value)
  },
})

const numberEquals = (param: string, rowField: string): FilterCase => ({
  param,
  rowField,
  pick: (rows) =>
    rows.find(
      (row) =>
        typeof row[rowField] === "number" && Number.isFinite(row[rowField]),
    ),
  serialize: (value) => String(value),
  assert: (row, value) => {
    expect(Number(row[rowField])).toBe(Number(value))
  },
})

const numberTolerance = (param: string, rowField: string): FilterCase => ({
  param,
  rowField,
  pick: (rows) =>
    rows.find(
      (row) =>
        typeof row[rowField] === "number" && Number.isFinite(row[rowField]),
    ),
  serialize: (value) => String(value),
  assert: (row, value) => {
    const expected = Number(value)
    const actual = Number(row[rowField])
    if (!Number.isFinite(actual)) return
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
      Math.abs(expected) * 0.0001 + 1e-12,
    )
  },
})

const routeCases: RouteCase[] = [
  {
    name: "accelerometers",
    path: "/accelerometers/list?json=true",
    responseKey: "accelerometers",
    requiredFields: ["lcsc", "mfr", "package", "has_spi", "has_i2c"],
    booleanFields: ["has_spi", "has_i2c", "has_uart"],
    filters: [stringEquals("package"), stringEquals("axes")],
  },
  {
    name: "analog_multiplexers",
    path: "/analog_multiplexers/list?json=true",
    responseKey: "multiplexers",
    requiredFields: ["lcsc", "mfr", "package", "num_channels", "has_spi"],
    booleanFields: ["has_spi", "has_i2c", "has_enable"],
    filters: [stringEquals("package")],
  },
  {
    name: "battery_holders",
    path: "/battery_holders/list?json=true",
    responseKey: "battery_holders",
    requiredFields: ["lcsc", "mfr", "package"],
    filters: [stringEquals("battery_type")],
  },
  {
    name: "bjt_transistors",
    path: "/bjt_transistors/list?json=true",
    responseKey: "bjt_transistors",
    requiredFields: [
      "lcsc",
      "mfr",
      "package",
      "collector_current",
      "collector_emitter_voltage",
    ],
    filters: [stringEquals("package")],
  },
  {
    name: "boost_converters",
    path: "/boost_converters/list?json=true",
    responseKey: "boost_converters",
    requiredFields: ["lcsc", "mfr", "package"],
    filters: [stringEquals("package")],
  },
  {
    name: "buck_boost_converters",
    path: "/buck_boost_converters/list?json=true",
    responseKey: "buck_boost_converters",
    requiredFields: ["lcsc", "mfr", "package"],
    filters: [stringEquals("package")],
  },
  {
    name: "capacitors",
    path: "/capacitors/list?json=true",
    responseKey: "capacitors",
    requiredFields: [
      "lcsc",
      "mfr",
      "package",
      ["capacitance", "capacitance_farads"],
    ],
    filters: [
      stringEquals("package"),
      numberTolerance("capacitance", "capacitance_farads"),
    ],
  },
  {
    name: "components",
    path: "/components/list?json=true",
    responseKey: "components",
    requiredFields: [
      "lcsc",
      "mfr",
      "package",
      "description",
      ["price", "price1"],
    ],
  },
  {
    name: "diodes",
    path: "/diodes/list?json=true",
    responseKey: "diodes",
    requiredFields: ["lcsc", "mfr", "package", "diode_type"],
    filters: [stringEquals("package")],
  },
  {
    name: "fpc_connectors",
    path: "/fpc_connectors/list?json=true",
    responseKey: "fpc_connectors",
    requiredFields: ["lcsc", "mfr"],
  },
  {
    name: "fpgas",
    path: "/fpgas/list?json=true",
    responseKey: "fpgas",
    requiredFields: ["lcsc", "mfr", "package", "logic_elements"],
  },
  {
    name: "fuses",
    path: "/fuses/list.json?json=true",
    responseKey: "fuses",
    requiredFields: [
      "lcsc",
      "mfr",
      "package",
      "current_rating",
      "response_time",
    ],
    booleanFields: ["is_surface_mount", "is_glass_encased", "is_resettable"],
    filters: [
      stringEquals("package"),
      numberEquals("current_rating", "current_rating"),
    ],
  },
  {
    name: "gas_sensors",
    path: "/gas_sensors/list?json=true",
    responseKey: "gas_sensors",
    requiredFields: ["lcsc", "mfr", "package", "measures_oxygen"],
    booleanFields: ["measures_oxygen"],
  },
  {
    name: "gyroscopes",
    path: "/gyroscopes/list?json=true",
    responseKey: "gyroscopes",
    requiredFields: ["lcsc", "mfr", "package", "has_spi", "has_i2c"],
    booleanFields: ["has_spi", "has_i2c", "has_uart"],
    filters: [stringEquals("package"), stringEquals("axes")],
  },
  {
    name: "headers",
    path: "/headers/list?json=true",
    responseKey: "headers",
    requiredFields: ["lcsc", "mfr", "package", "pitch_mm"],
    booleanFields: ["is_right_angle", "is_shrouded"],
    filters: [numberEquals("pitch", "pitch_mm"), stringEquals("gender")],
  },
  {
    name: "jst_connectors",
    path: "/jst_connectors/list?json=true",
    responseKey: "jst_connectors",
    requiredFields: ["lcsc", "mfr", "pitch_mm"],
    filters: [numberEquals("pitch_mm", "pitch_mm")],
  },
  {
    name: "lcd_displays",
    path: "/lcd_display/list.json?json=true",
    responseKey: "lcd_displays",
    requiredFields: ["lcsc", "mfr", "package", "display_type"],
    filters: [stringEquals("package"), stringEquals("display_type")],
  },
  {
    name: "led_dot_matrix_displays",
    path: "/led_dot_matrix_display/list.json?json=true",
    responseKey: "led_dot_matrix_displays",
    requiredFields: ["lcsc", "mfr", "package", "matrix_size"],
    filters: [stringEquals("package"), stringEquals("color")],
  },
  {
    name: "led_drivers",
    path: "/led_drivers/list?json=true",
    responseKey: "led_drivers",
    requiredFields: ["lcsc", "mfr", "package", "channel_count"],
    filters: [stringEquals("package")],
  },
  {
    name: "led_segment_displays",
    path: "/led_segment_display/list.json?json=true",
    responseKey: "led_segment_displays",
    requiredFields: ["lcsc", "mfr", "package", ["positions", "type"]],
    filters: [stringEquals("package"), stringEquals("type")],
  },
  {
    name: "leds_with_ic",
    path: "/led_with_ic/list.json?json=true",
    responseKey: "leds_with_ic",
    requiredFields: ["lcsc", "mfr", "package", "stock", ["price", "price1"]],
    filters: [
      stringEquals("package"),
      stringEquals("color"),
      stringEquals("protocol"),
    ],
  },
  {
    name: "leds",
    path: "/leds/list?json=true",
    responseKey: "leds",
    requiredFields: ["lcsc", "mfr", "package"],
    filters: [stringEquals("package"), stringEquals("color")],
  },
  {
    name: "ldos",
    path: "/ldos/list?json=true",
    responseKey: "ldos",
    requiredFields: ["lcsc", "mfr", "package", "output_type", "is_positive"],
    booleanFields: ["is_positive"],
    filters: [stringEquals("package"), stringEquals("output_type")],
  },
  {
    name: "microcontrollers",
    path: "/microcontrollers/list?json=true",
    responseKey: "microcontrollers",
    requiredFields: ["lcsc", "mfr", "package", "cpu_core", "has_uart"],
    booleanFields: ["has_uart", "has_i2c", "has_spi"],
    filters: [stringEquals("package"), stringEquals("core")],
  },
  {
    name: "mosfets",
    path: "/mosfets/list?json=true",
    responseKey: "mosfets",
    requiredFields: ["lcsc", "mfr", "package", "drain_source_voltage"],
    filters: [stringEquals("package")],
  },
  {
    name: "oled_displays",
    path: "/oled_display/list.json?json=true",
    responseKey: "oled_displays",
    requiredFields: ["lcsc", "mfr", "package", "protocol"],
    filters: [stringEquals("package"), stringEquals("protocol")],
  },
  {
    name: "pcie_m2_connectors",
    path: "/pcie_m2_connectors/list?json=true",
    responseKey: "pcie_m2_connectors",
    requiredFields: ["lcsc", "key"],
    filters: [stringEquals("key")],
  },
  {
    name: "relays",
    path: "/relays/list?json=true",
    responseKey: "relays",
    requiredFields: ["lcsc", "mfr", "package", "relay_type"],
    filters: [stringEquals("package"), stringEquals("relay_type")],
  },
  {
    name: "resistors",
    path: "/resistors/list?json=true",
    responseKey: "resistors",
    requiredFields: ["lcsc", "mfr", "package", "resistance"],
    filters: [
      stringEquals("package"),
      numberTolerance("resistance", "resistance"),
    ],
  },
  {
    name: "switches",
    path: "/switches/list?json=true",
    responseKey: "switches",
    requiredFields: ["lcsc", "mfr", "package", "pin_count", "switch_type"],
    booleanFields: ["is_latching"],
    filters: [
      stringEquals("package"),
      stringEquals("circuit"),
      numberEquals("pin_count", "pin_count"),
    ],
  },
  {
    name: "usb_c_connectors",
    path: "/usb_c_connectors/list?json=true",
    responseKey: "usb_c_connectors",
    requiredFields: ["lcsc", "mfr", "package"],
    filters: [stringEquals("package"), stringEquals("gender")],
  },
  {
    name: "voltage_regulators",
    path: "/voltage_regulators/list?json=true",
    responseKey: "regulators",
    requiredFields: ["lcsc", "mfr", "package", "output_type", "is_positive"],
    booleanFields: ["is_low_dropout", "is_positive"],
    filters: [stringEquals("package"), stringEquals("output_type")],
  },
]

describe("Cloudflare route contracts", () => {
  it("GET /health returns ok", async () => {
    const { response, data } = await fetchJson("/health")
    if (response.status === 502) {
      console.warn("Skipping health check: upstream returned 502")
      return
    }
    expect(response.ok).toBe(true)
    expect(data.ok).toBe(true)
  })

  it("GET /api/search returns components with stable core fields", async () => {
    const { response, data } = await fetchJson("/api/search?q=STM32F401RCT6")
    expect(response.ok).toBe(true)
    expect(Array.isArray(data.components)).toBe(true)
    expect(data.components.length).toBeGreaterThan(0)
    expectRowHasFields(data.components[0], [
      "lcsc",
      "mfr",
      "package",
      "description",
      ["price", "price1"],
      "stock",
    ])
  })

  it("GET /api/search strips a leading C in LCSC lookups", async () => {
    const source = await fetchJson("/resistors/list?json=true")
    const sourceRows = source.data.resistors as any[]
    expect(sourceRows.length).toBeGreaterThan(0)

    const lcsc = sourceRows[0].lcsc
    const { data } = await fetchJson(`/api/search?q=C${lcsc}`)
    expect(Array.isArray(data.components)).toBe(true)
    expect(data.components.length).toBeGreaterThan(0)
    expect(data.components[0].lcsc).toBe(lcsc)
  })

  it("GET /api/search finds crystal parts by category text in the catalog", async () => {
    const { response, data } = await fetchJson(
      "/api/search?limit=10&q=12MHz%20crystal",
    )
    expect(response.ok).toBe(true)
    expect(Array.isArray(data.components)).toBe(true)
    expect(data.components.length).toBeGreaterThan(0)
    expect(
      data.components.some(
        (component: any) =>
          component.lcsc === 9002 && component.is_basic === true,
      ),
    ).toBe(true)
  })

  it("GET /components/list returns component data", async () => {
    const { response, data } = await fetchJson("/components/list?json=true")
    expect(response.ok).toBe(true)
    expect(Array.isArray(data.components)).toBe(true)
  })

  it("GET /not-found/list?json=true returns a 404-style error payload", async () => {
    const { response, data } = await fetchJson("/not-found/list?json=true")
    expect(response.status).toBe(404)
    expect(data.error?.error_code).toBe("not_found")
  })

  for (const routeCase of routeCases) {
    it(`GET ${routeCase.path} returns ${routeCase.responseKey}`, async () => {
      const { response, data } = await fetchJson(routeCase.path)
      expect(response.ok).toBe(true)
      expect(Array.isArray(data[routeCase.responseKey])).toBe(true)

      const rows = data[routeCase.responseKey] as any[]
      if (rows.length === 0) return

      expectRowHasFields(rows[0], routeCase.requiredFields)
      expect(typeof rows[0].lcsc).toBe("number")

      for (const field of routeCase.booleanFields ?? []) {
        if (field in rows[0] && rows[0][field] !== null) {
          expect(typeof rows[0][field]).toBe("boolean")
        }
      }
    })

    for (const filter of routeCase.filters ?? []) {
      it(`GET ${routeCase.path} respects ${filter.param}`, async () => {
        const { data } = await fetchJson(routeCase.path)
        const rows = data[routeCase.responseKey] as any[]
        if (!Array.isArray(rows) || rows.length === 0) return

        const picked =
          filter.pick?.(rows) ??
          rows.find(
            (row) =>
              row[filter.rowField] !== null &&
              row[filter.rowField] !== undefined &&
              row[filter.rowField] !== "",
          )

        if (!picked) return

        const rawValue =
          typeof picked === "object" && picked !== null
            ? picked[filter.rowField]
            : picked

        if (rawValue === null || rawValue === undefined || rawValue === "")
          return

        const serialized = encodeURIComponent(
          filter.serialize ? filter.serialize(rawValue) : String(rawValue),
        )
        const separator = routeCase.path.includes("?") ? "&" : "?"
        const filtered = await fetchJson(
          `${routeCase.path}${separator}${filter.param}=${serialized}`,
        )
        const filteredRows = filtered.data[routeCase.responseKey] as any[]

        expect(Array.isArray(filteredRows)).toBe(true)
        for (const row of filteredRows) {
          filter.assert(row, rawValue)
        }
      })
    }
  }
})
