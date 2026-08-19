import { Kysely, sql, type RawBuilder } from "kysely"
import type { DB } from "../db/types"

export type QueryParams = Record<string, string>

interface FilterConfig {
  field: string
  type:
    | "string"
    | "number"
    | "boolean"
    | "number_tolerance"
    | "number_range_contains"
    | "number_distance_from_param"
    | "number_excludes_ranges"
  operator?: "=" | ">=" | "<=" | ">" | "<"
  maxField?: string
  fallbackField?: string
  relativeToParam?: string
  placeholder?: string
  helpText?: string
}

interface TableConfig {
  filters: Record<string, FilterConfig>
  paramAliases?: Record<string, string>
  targetSort?: {
    field: string
    param: string
  }
  helpText?: string
}

export type FilterOptions = Record<string, string[]>

// Allowed operators for sanitization
const ALLOWED_OPERATORS = new Set(["=", ">=", "<=", ">", "<"])

const parseNumberRanges = (value: string): Array<[number, number]> =>
  value
    .split(",")
    .map((range) => range.trim())
    .filter(Boolean)
    .flatMap((range): Array<[number, number]> => {
      const rangeMatch = range.match(
        /^(\d+(?:\.\d+)?)\s*(?:-|–|—|\.\.)\s*(\d+(?:\.\d+)?)$/,
      )
      if (rangeMatch) {
        const first = Number(rangeMatch[1])
        const second = Number(rangeMatch[2])
        return [[Math.min(first, second), Math.max(first, second)]]
      }

      const singleValue = Number(range)
      return Number.isFinite(singleValue) ? [[singleValue, singleValue]] : []
    })

const isBooleanLikeField = (field: string): boolean =>
  field === "in_stock" ||
  field.startsWith("is_") ||
  field.startsWith("has_") ||
  field.startsWith("measures_")

const normalizeJsonRow = (
  row: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (isBooleanLikeField(key) && (value === 0 || value === 1)) {
        return [key, Boolean(value)]
      }
      return [key, value]
    }),
  )

/**
 * Generic query handler that builds a query based on table name and params.
 * Uses parameterized queries to prevent SQL injection.
 */
export async function queryTable(
  db: Kysely<DB>,
  tableName: string,
  params: QueryParams,
  config: TableConfig,
): Promise<unknown[]> {
  // Validate table name (must be in our known list)
  if (!TABLE_CONFIGS[tableName] && tableName !== "resistor") {
    throw new Error(`Unknown table: ${tableName}`)
  }

  // Build WHERE conditions using Kysely's sql template tag for safe parameterization
  const conditions: RawBuilder<unknown>[] = []

  // Apply filters based on config
  for (const [paramName, fieldConfig] of Object.entries(config.filters)) {
    const value = params[paramName]
    if (value === undefined || value === "" || value === "All") continue

    const {
      field,
      type,
      operator = "=",
      maxField,
      fallbackField,
      relativeToParam,
    } = fieldConfig

    // Validate operator
    if (!ALLOWED_OPERATORS.has(operator)) {
      throw new Error(`Invalid operator: ${operator}`)
    }

    // Use sql.id for column names to prevent injection
    const column = sql.id(field)

    if (type === "string") {
      if (operator === "=") {
        conditions.push(sql`${column} = ${value}`)
      } else if (operator === ">=") {
        conditions.push(sql`${column} >= ${value}`)
      } else if (operator === "<=") {
        conditions.push(sql`${column} <= ${value}`)
      }
    } else if (type === "number") {
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        if (operator === "=") {
          conditions.push(sql`${column} = ${numValue}`)
        } else if (operator === ">=") {
          conditions.push(sql`${column} >= ${numValue}`)
        } else if (operator === "<=") {
          conditions.push(sql`${column} <= ${numValue}`)
        } else if (operator === ">") {
          conditions.push(sql`${column} > ${numValue}`)
        } else if (operator === "<") {
          conditions.push(sql`${column} < ${numValue}`)
        }
      }
    } else if (type === "boolean") {
      const boolValue = value === "true" || value === "1" ? 1 : 0
      conditions.push(sql`${column} = ${boolValue}`)
    } else if (type === "number_tolerance") {
      // For resistance/capacitance with tolerance
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        const delta = numValue * 0.0001
        conditions.push(sql`${column} >= ${numValue - delta}`)
        conditions.push(sql`${column} <= ${numValue + delta}`)
      }
    } else if (type === "number_range_contains") {
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        if (!maxField) {
          throw new Error(`Missing maxField for range filter: ${paramName}`)
        }

        const maxColumn = sql.id(maxField)
        if (fallbackField) {
          const fallbackColumn = sql.id(fallbackField)
          conditions.push(sql`(
            (${column} IS NOT NULL AND ${maxColumn} IS NOT NULL
              AND ${column} <= ${numValue} AND ${maxColumn} >= ${numValue})
            OR
            ((${column} IS NULL OR ${maxColumn} IS NULL)
              AND ${fallbackColumn} = ${numValue})
          )`)
        } else {
          conditions.push(
            sql`${column} <= ${numValue} AND ${maxColumn} >= ${numValue}`,
          )
        }
      }
    } else if (type === "number_distance_from_param") {
      const maxDistance = parseFloat(value)
      const relativeValue = relativeToParam
        ? parseFloat(params[relativeToParam] ?? "")
        : Number.NaN
      if (
        Number.isFinite(maxDistance) &&
        maxDistance >= 0 &&
        Number.isFinite(relativeValue)
      ) {
        conditions.push(sql`${column} IS NOT NULL`)
        conditions.push(sql`${column} >= ${relativeValue - maxDistance}`)
        conditions.push(sql`${column} <= ${relativeValue + maxDistance}`)
      }
    } else if (type === "number_excludes_ranges") {
      for (const [rangeMin, rangeMax] of parseNumberRanges(value)) {
        conditions.push(
          sql`${column} IS NOT NULL AND (${column} < ${rangeMin} OR ${column} > ${rangeMax})`,
        )
      }
    }
  }

  // Build the final query
  const table = sql.id(tableName)
  const targetSortValue = config.targetSort
    ? parseFloat(params[config.targetSort.param] ?? "")
    : Number.NaN
  const orderBy =
    config.targetSort && Number.isFinite(targetSortValue)
      ? sql`${sql.id(config.targetSort.field)} IS NULL ASC, ABS(${sql.id(config.targetSort.field)} - ${targetSortValue}) ASC, stock DESC`
      : sql`stock DESC`
  let query: RawBuilder<unknown>

  if (conditions.length === 0) {
    query = sql`SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT 100`
  } else {
    // Join conditions with AND
    const whereClause = sql.join(conditions, sql` AND `)
    query = sql`SELECT * FROM ${table} WHERE ${whereClause} ORDER BY ${orderBy} LIMIT 100`
  }

  const result = await query.execute(db)
  return (result.rows as Array<Record<string, unknown>>).map(normalizeJsonRow)
}

export async function queryFilterOptions(
  db: Kysely<DB>,
  tableName: string,
  config: TableConfig,
): Promise<FilterOptions> {
  const options: FilterOptions = {}

  for (const [paramName, fieldConfig] of Object.entries(config.filters)) {
    if (
      fieldConfig.type === "boolean" ||
      fieldConfig.type === "number_range_contains" ||
      fieldConfig.type === "number_distance_from_param" ||
      fieldConfig.type === "number_excludes_ranges"
    )
      continue

    const field = sql.id(fieldConfig.field)
    const table = sql.id(tableName)
    const orderExpression =
      fieldConfig.type === "string"
        ? sql`${field}`
        : sql`CAST(${field} AS REAL)`
    const query = sql`
      SELECT CAST(${field} AS TEXT) AS value
      FROM ${table}
      WHERE ${field} IS NOT NULL
        AND TRIM(CAST(${field} AS TEXT)) != ''
      GROUP BY ${field}
      ORDER BY COUNT(*) DESC, ${orderExpression} ASC
      LIMIT 100
    `

    const result = await query.execute(db)
    options[paramName] = (result.rows as Array<{ value: string | null }>)
      .map((row) => row.value?.trim() ?? "")
      .filter(Boolean)
  }

  return options
}

// Configuration for all derived tables
export const TABLE_CONFIGS: Record<string, TableConfig> = {
  resistor: {
    filters: {
      package: { field: "package", type: "string" },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
      resistance: { field: "resistance", type: "number_tolerance" },
    },
  },
  capacitor: {
    filters: {
      package: { field: "package", type: "string" },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
      capacitance: { field: "capacitance_farads", type: "number_tolerance" },
    },
  },
  microcontroller: {
    filters: {
      package: { field: "package", type: "string" },
      core: { field: "cpu_core", type: "string" },
      flash_min: { field: "flash_size_bytes", type: "number", operator: ">=" },
      ram_min: { field: "ram_size_bytes", type: "number", operator: ">=" },
    },
  },
  micro_usb_connector: {
    filters: {
      package: { field: "package", type: "string" },
      connector_type: { field: "connector_type", type: "string" },
      usb_standard: { field: "usb_standard", type: "string" },
      mounting_style: { field: "mounting_style", type: "string" },
      number_of_contacts: { field: "number_of_contacts", type: "number" },
      gender: { field: "gender", type: "string" },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
    },
  },
  ldo: {
    filters: {
      package: { field: "package", type: "string" },
      output_type: { field: "output_type", type: "string" },
      output_voltage: {
        field: "output_voltage_min",
        type: "number",
        operator: "<=",
      },
    },
  },
  led: {
    filters: {
      package: { field: "package", type: "string" },
      color: { field: "color", type: "string" },
    },
  },
  diode: {
    filters: {
      package: { field: "package", type: "string" },
      diode_type: { field: "diode_type", type: "string" },
    },
  },
  photo_diode: {
    paramAliases: { wavelength_min: "wavelength" },
    targetSort: { field: "peak_wavelength_nm", param: "wavelength" },
    helpText:
      "These filters use catalog peak wavelength and advertised spectral range, not a full responsivity curve. Verify the datasheet; optical filtering may be needed for out-of-band rejection.",
    filters: {
      package: { field: "package", type: "string" },
      wavelength: {
        field: "spectral_range_min_nm",
        maxField: "spectral_range_max_nm",
        fallbackField: "peak_wavelength_nm",
        type: "number_range_contains",
        placeholder: "355",
        helpText:
          "Must be inside the published spectral range. Results are ranked by closeness to peak response.",
      },
      peak_distance_max: {
        field: "peak_wavelength_nm",
        type: "number_distance_from_param",
        relativeToParam: "wavelength",
        placeholder: "100",
        helpText:
          "Optional maximum distance between the target and peak wavelengths.",
      },
      excluded_peak_bands: {
        field: "peak_wavelength_nm",
        type: "number_excludes_ranges",
        placeholder: "700-1100, 532",
        helpText:
          "Comma-separated wavelengths or ranges whose peak response should be excluded.",
      },
      reverse_voltage_min: {
        field: "reverse_voltage",
        type: "number",
        operator: ">=",
      },
      dark_current_max: {
        field: "dark_current_a",
        type: "number",
        operator: "<=",
      },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
    },
  },
  dimm_connector: {
    filters: {
      package: { field: "package", type: "string" },
      ddr_standard: { field: "ddr_standard", type: "string" },
      num_pins: { field: "num_pins", type: "number" },
      pitch: { field: "pitch_mm", type: "number" },
      height_mm: { field: "height_above_board_mm", type: "number" },
      mounting_type: { field: "mounting_type", type: "string" },
      is_right_angle: { field: "is_right_angle", type: "boolean" },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
    },
  },
  mosfet: {
    filters: {
      package: { field: "package", type: "string" },
      drain_source_voltage_min: {
        field: "drain_source_voltage",
        type: "number",
        operator: ">=",
      },
      drain_source_voltage_max: {
        field: "drain_source_voltage",
        type: "number",
        operator: "<=",
      },
      continuous_drain_current_min: {
        field: "continuous_drain_current",
        type: "number",
        operator: ">=",
      },
      continuous_drain_current_max: {
        field: "continuous_drain_current",
        type: "number",
        operator: "<=",
      },
      gate_threshold_voltage_min: {
        field: "gate_threshold_voltage",
        type: "number",
        operator: ">=",
      },
      gate_threshold_voltage_max: {
        field: "gate_threshold_voltage",
        type: "number",
        operator: "<=",
      },
      power_dissipation_min: {
        field: "power_dissipation",
        type: "number",
        operator: ">=",
      },
      power_dissipation_max: {
        field: "power_dissipation",
        type: "number",
        operator: "<=",
      },
      mounting_style: { field: "mounting_style", type: "string" },
    },
  },
  switch: {
    filters: {
      package: { field: "package", type: "string" },
      switch_type: { field: "switch_type", type: "string" },
      circuit: { field: "circuit", type: "string" },
      pin_count: { field: "pin_count", type: "number" },
    },
  },
  header: {
    filters: {
      pitch: { field: "pitch_mm", type: "number" },
      num_pins: { field: "num_pins", type: "number" },
      gender: { field: "gender", type: "string" },
      is_right_angle: { field: "is_right_angle", type: "boolean" },
    },
  },
  accelerometer: {
    filters: {
      package: { field: "package", type: "string" },
      axes: { field: "axes", type: "string" },
    },
  },
  adc: {
    filters: {
      package: { field: "package", type: "string" },
      resolution_bits: { field: "resolution_bits", type: "number" },
      num_channels: { field: "num_channels", type: "number" },
    },
  },
  analog_multiplexer: {
    filters: {
      package: { field: "package", type: "string" },
      num_channels: { field: "num_channels", type: "number" },
    },
  },
  barrel_jack: {
    filters: {
      package: { field: "package", type: "string" },
      mounting_style: { field: "mounting_style", type: "string" },
      orientation: { field: "orientation", type: "string" },
      inside_diameter_mm: { field: "inside_diameter_mm", type: "number" },
      outside_diameter_mm: { field: "outside_diameter_mm", type: "number" },
      current_rating_min: {
        field: "current_rating_a",
        type: "number",
        operator: ">=",
      },
      voltage_rating_min: {
        field: "voltage_rating_v",
        type: "number",
        operator: ">=",
      },
      num_pins: { field: "num_pins", type: "number" },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
    },
  },
  battery_holder: {
    filters: {
      package: { field: "package", type: "string" },
      battery_type: { field: "battery_type", type: "string" },
    },
  },
  ble_chip: {
    filters: {
      package: { field: "package", type: "string" },
      bluetooth_version: { field: "bluetooth_version", type: "string" },
      core_processor: { field: "core_processor", type: "string" },
      has_uart: { field: "has_uart", type: "boolean" },
      has_i2c: { field: "has_i2c", type: "boolean" },
      has_spi: { field: "has_spi", type: "boolean" },
      has_usb: { field: "has_usb", type: "boolean" },
    },
  },
  ble_module: {
    filters: {
      package: { field: "package", type: "string" },
      bluetooth_version: { field: "bluetooth_version", type: "string" },
      core_processor: { field: "core_processor", type: "string" },
      antenna_type: { field: "antenna_type", type: "string" },
      has_uart: { field: "has_uart", type: "boolean" },
      has_i2c: { field: "has_i2c", type: "boolean" },
      has_spi: { field: "has_spi", type: "boolean" },
      has_usb: { field: "has_usb", type: "boolean" },
    },
  },
  bjt_transistor: {
    filters: {
      package: { field: "package", type: "string" },
    },
  },
  boost_converter: {
    filters: {
      package: { field: "package", type: "string" },
      output_voltage_min: {
        field: "output_voltage_min",
        type: "number",
        operator: "<=",
      },
      output_voltage_max: {
        field: "output_voltage_max",
        type: "number",
        operator: ">=",
      },
    },
  },
  buck_boost_converter: {
    filters: {
      package: { field: "package", type: "string" },
    },
  },
  dac: {
    filters: {
      package: { field: "package", type: "string" },
      resolution_bits: { field: "resolution_bits", type: "number" },
      num_channels: { field: "num_channels", type: "number" },
    },
  },
  fpc_connector: {
    filters: {
      pitch_mm: { field: "pitch_mm", type: "number" },
      number_of_contacts: { field: "number_of_contacts", type: "number" },
    },
  },
  fpga: {
    filters: {
      package: { field: "package", type: "string" },
      type: { field: "type", type: "string" },
    },
  },
  fuse: {
    filters: {
      package: { field: "package", type: "string" },
      current_rating: { field: "current_rating", type: "number" },
    },
  },
  gas_sensor: {
    filters: {
      package: { field: "package", type: "string" },
      sensor_type: { field: "sensor_type", type: "string" },
    },
  },
  hdmi_port: {
    filters: {
      package: { field: "package", type: "string" },
      mounting_style: { field: "mounting_style", type: "string" },
      orientation: { field: "orientation", type: "string" },
      gender: { field: "gender", type: "string" },
      number_of_pins: { field: "number_of_pins", type: "number" },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
    },
  },
  gyroscope: {
    filters: {
      package: { field: "package", type: "string" },
      axes: { field: "axes", type: "string" },
    },
  },
  io_expander: {
    filters: {
      package: { field: "package", type: "string" },
      num_gpios: { field: "num_gpios", type: "number" },
    },
  },
  jst_connector: {
    filters: {
      package: { field: "package", type: "string" },
      num_pins: { field: "num_pins", type: "number" },
      pitch_mm: { field: "pitch_mm", type: "number" },
    },
  },
  lcd_display: {
    filters: {
      package: { field: "package", type: "string" },
      display_type: { field: "display_type", type: "string" },
    },
  },
  led_dot_matrix_display: {
    filters: {
      package: { field: "package", type: "string" },
      color: { field: "color", type: "string" },
    },
  },
  led_driver: {
    filters: {
      package: { field: "package", type: "string" },
      channel_count: { field: "channel_count", type: "number" },
    },
  },
  led_segment_display: {
    filters: {
      package: { field: "package", type: "string" },
      color: { field: "color", type: "string" },
      type: { field: "type", type: "string" },
    },
  },
  led_with_ic: {
    filters: {
      package: { field: "package", type: "string" },
      color: { field: "color", type: "string" },
      protocol: { field: "protocol", type: "string" },
    },
  },
  oled_display: {
    filters: {
      package: { field: "package", type: "string" },
      protocol: { field: "protocol", type: "string" },
    },
  },
  pcie_m2_connector: {
    filters: {
      key: { field: "key", type: "string" },
    },
  },
  potentiometer: {
    filters: {
      package: { field: "package", type: "string" },
      max_resistance: { field: "max_resistance", type: "number" },
    },
  },
  relay: {
    filters: {
      package: { field: "package", type: "string" },
      relay_type: { field: "relay_type", type: "string" },
      coil_voltage: { field: "coil_voltage", type: "number" },
    },
  },
  resistor_array: {
    filters: {
      package: { field: "package", type: "string" },
      resistance: { field: "resistance", type: "number_tolerance" },
      number_of_resistors: { field: "number_of_resistors", type: "number" },
    },
  },
  sodimm_connector: {
    filters: {
      package: { field: "package", type: "string" },
      ddr_standard: { field: "ddr_standard", type: "string" },
      num_pins: { field: "num_pins", type: "number" },
      pitch: { field: "pitch_mm", type: "number" },
      height_mm: { field: "height_above_board_mm", type: "number" },
      mounting_type: { field: "mounting_type", type: "string" },
      is_right_angle: { field: "is_right_angle", type: "boolean" },
      is_basic: { field: "is_basic", type: "boolean" },
      is_preferred: { field: "is_preferred", type: "boolean" },
    },
  },
  spring_clamp_terminal_block: {
    filters: {
      pitch: { field: "pitch_mm", type: "number" },
      pins: { field: "num_pins", type: "number" },
    },
  },
  usb_c_connector: {
    filters: {
      package: { field: "package", type: "string" },
      mounting_style: { field: "mounting_style", type: "string" },
      gender: { field: "gender", type: "string" },
    },
  },
  voltage_regulator: {
    filters: {
      package: { field: "package", type: "string" },
      output_type: { field: "output_type", type: "string" },
    },
  },
  wifi_module: {
    filters: {
      package: { field: "package", type: "string" },
      antenna_type: { field: "antenna_type", type: "string" },
    },
  },
  wire_to_board_connector: {
    filters: {
      package: { field: "package", type: "string" },
      num_pins: { field: "num_pins", type: "number" },
      pitch_mm: { field: "pitch_mm", type: "number" },
      gender: { field: "gender", type: "string" },
    },
  },
}

export function normalizeTableQueryParams(
  tableName: string,
  params: QueryParams,
): QueryParams {
  const aliases = TABLE_CONFIGS[tableName]?.paramAliases
  if (!aliases) return params

  let normalizedParams = params
  for (const [alias, canonicalParam] of Object.entries(aliases)) {
    if (params[canonicalParam] === undefined && params[alias] !== undefined) {
      if (normalizedParams === params) normalizedParams = { ...params }
      normalizedParams[canonicalParam] = params[alias]
    }
  }

  return normalizedParams
}

// Map URL paths to table names
export const ROUTE_TO_TABLE: Record<string, string> = {
  "/resistors/list": "resistor",
  "/capacitors/list": "capacitor",
  "/microcontrollers/list": "microcontroller",
  "/micro_usb_connectors/list": "micro_usb_connector",
  "/ldos/list": "ldo",
  "/leds/list": "led",
  "/diodes/list": "diode",
  "/photo_diodes/list": "photo_diode",
  "/mosfets/list": "mosfet",
  "/switches/list": "switch",
  "/headers/list": "header",
  "/accelerometers/list": "accelerometer",
  "/adcs/list": "adc",
  "/analog_multiplexers/list": "analog_multiplexer",
  "/barrel_jacks/list": "barrel_jack",
  "/battery_holders/list": "battery_holder",
  "/ble_chips/list": "ble_chip",
  "/ble_modules/list": "ble_module",
  "/bjt_transistors/list": "bjt_transistor",
  "/boost_converters/list": "boost_converter",
  "/buck_boost_converters/list": "buck_boost_converter",
  "/dacs/list": "dac",
  "/dimm_connectors/list": "dimm_connector",
  "/fpc_connectors/list": "fpc_connector",
  "/fpgas/list": "fpga",
  "/fuses/list": "fuse",
  "/gas_sensors/list": "gas_sensor",
  "/hdmi_ports/list": "hdmi_port",
  "/gyroscopes/list": "gyroscope",
  "/io_expanders/list": "io_expander",
  "/jst_connectors/list": "jst_connector",
  "/lcd_display/list": "lcd_display",
  "/led_dot_matrix_display/list": "led_dot_matrix_display",
  "/led_drivers/list": "led_driver",
  "/led_segment_display/list": "led_segment_display",
  "/led_with_ic/list": "led_with_ic",
  "/oled_display/list": "oled_display",
  "/pcie_m2_connectors/list": "pcie_m2_connector",
  "/potentiometers/list": "potentiometer",
  "/relays/list": "relay",
  "/resistor_arrays/list": "resistor_array",
  "/sodimm_connectors/list": "sodimm_connector",
  "/spring_clamp_terminal_blocks/list": "spring_clamp_terminal_block",
  "/usb_c_connectors/list": "usb_c_connector",
  "/voltage_regulators/list": "voltage_regulator",
  "/wifi_modules/list": "wifi_module",
  "/wire_to_board_connectors/list": "wire_to_board_connector",
}

// Response key for each table (plural form for JSON response)
export const TABLE_RESPONSE_KEY: Record<string, string> = {
  resistor: "resistors",
  capacitor: "capacitors",
  microcontroller: "microcontrollers",
  micro_usb_connector: "micro_usb_connectors",
  ldo: "ldos",
  led: "leds",
  diode: "diodes",
  photo_diode: "photo_diodes",
  mosfet: "mosfets",
  switch: "switches",
  header: "headers",
  accelerometer: "accelerometers",
  adc: "adcs",
  analog_multiplexer: "multiplexers",
  barrel_jack: "barrel_jacks",
  battery_holder: "battery_holders",
  ble_chip: "ble_chips",
  ble_module: "ble_modules",
  bjt_transistor: "bjt_transistors",
  boost_converter: "boost_converters",
  buck_boost_converter: "buck_boost_converters",
  dac: "dacs",
  dimm_connector: "dimm_connectors",
  fpc_connector: "fpc_connectors",
  fpga: "fpgas",
  fuse: "fuses",
  gas_sensor: "gas_sensors",
  hdmi_port: "hdmi_ports",
  gyroscope: "gyroscopes",
  io_expander: "io_expanders",
  jst_connector: "jst_connectors",
  lcd_display: "lcd_displays",
  led_dot_matrix_display: "led_dot_matrix_displays",
  led_driver: "led_drivers",
  led_segment_display: "led_segment_displays",
  led_with_ic: "leds_with_ic",
  oled_display: "oled_displays",
  pcie_m2_connector: "pcie_m2_connectors",
  potentiometer: "potentiometers",
  relay: "relays",
  resistor_array: "resistor_arrays",
  sodimm_connector: "sodimm_connectors",
  spring_clamp_terminal_block: "spring_clamp_terminal_blocks",
  usb_c_connector: "usb_c_connectors",
  voltage_regulator: "regulators",
  wifi_module: "wifi_modules",
  wire_to_board_connector: "wire_to_board_connectors",
}
