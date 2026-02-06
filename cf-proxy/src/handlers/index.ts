import { Kysely, sql, type RawBuilder } from "kysely"
import type { DB } from "../db/types"

export type QueryParams = Record<string, string>

interface FilterConfig {
  field: string
  type: "string" | "number" | "boolean" | "number_tolerance"
  operator?: "=" | ">=" | "<=" | ">" | "<"
}

interface TableConfig {
  filters: Record<string, FilterConfig>
}

// Allowed operators for sanitization
const ALLOWED_OPERATORS = new Set(["=", ">=", "<=", ">", "<"])

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

    const { field, type, operator = "=" } = fieldConfig

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
    }
  }

  // Build the final query
  const table = sql.id(tableName)
  let query: RawBuilder<unknown>

  if (conditions.length === 0) {
    query = sql`SELECT * FROM ${table} ORDER BY stock DESC LIMIT 100`
  } else {
    // Join conditions with AND
    const whereClause = sql.join(conditions, sql` AND `)
    query = sql`SELECT * FROM ${table} WHERE ${whereClause} ORDER BY stock DESC LIMIT 100`
  }

  const result = await query.execute(db)
  return result.rows as unknown[]
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
  ldo: {
    filters: {
      package: { field: "package", type: "string" },
      output_type: { field: "output_type", type: "string" },
      output_voltage: { field: "output_voltage_min", type: "number", operator: "<=" },
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
  mosfet: {
    filters: {
      package: { field: "package", type: "string" },
      drain_source_voltage_min: { field: "drain_source_voltage", type: "number", operator: ">=" },
      drain_source_voltage_max: { field: "drain_source_voltage", type: "number", operator: "<=" },
      continuous_drain_current_min: { field: "continuous_drain_current", type: "number", operator: ">=" },
      continuous_drain_current_max: { field: "continuous_drain_current", type: "number", operator: "<=" },
      gate_threshold_voltage_min: { field: "gate_threshold_voltage", type: "number", operator: ">=" },
      gate_threshold_voltage_max: { field: "gate_threshold_voltage", type: "number", operator: "<=" },
      power_dissipation_min: { field: "power_dissipation", type: "number", operator: ">=" },
      power_dissipation_max: { field: "power_dissipation", type: "number", operator: "<=" },
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
  battery_holder: {
    filters: {
      package: { field: "package", type: "string" },
      battery_type: { field: "battery_type", type: "string" },
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
      output_voltage_min: { field: "output_voltage_min", type: "number", operator: "<=" },
      output_voltage_max: { field: "output_voltage_max", type: "number", operator: ">=" },
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
  usb_c_connector: {
    filters: {
      package: { field: "package", type: "string" },
      mounting_style: { field: "mounting_style", type: "string" },
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

// Map URL paths to table names
export const ROUTE_TO_TABLE: Record<string, string> = {
  "/resistors/list": "resistor",
  "/capacitors/list": "capacitor",
  "/microcontrollers/list": "microcontroller",
  "/ldos/list": "ldo",
  "/leds/list": "led",
  "/diodes/list": "diode",
  "/mosfets/list": "mosfet",
  "/switches/list": "switch",
  "/headers/list": "header",
  "/accelerometers/list": "accelerometer",
  "/adcs/list": "adc",
  "/analog_multiplexers/list": "analog_multiplexer",
  "/battery_holders/list": "battery_holder",
  "/bjt_transistors/list": "bjt_transistor",
  "/boost_converters/list": "boost_converter",
  "/buck_boost_converters/list": "buck_boost_converter",
  "/dacs/list": "dac",
  "/fpc_connectors/list": "fpc_connector",
  "/fpgas/list": "fpga",
  "/fuses/list": "fuse",
  "/gas_sensors/list": "gas_sensor",
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
  ldo: "ldos",
  led: "leds",
  diode: "diodes",
  mosfet: "mosfets",
  switch: "switches",
  header: "headers",
  accelerometer: "accelerometers",
  adc: "adcs",
  analog_multiplexer: "analog_multiplexers",
  battery_holder: "battery_holders",
  bjt_transistor: "bjt_transistors",
  boost_converter: "boost_converters",
  buck_boost_converter: "buck_boost_converters",
  dac: "dacs",
  fpc_connector: "fpc_connectors",
  fpga: "fpgas",
  fuse: "fuses",
  gas_sensor: "gas_sensors",
  gyroscope: "gyroscopes",
  io_expander: "io_expanders",
  jst_connector: "jst_connectors",
  lcd_display: "lcd_displays",
  led_dot_matrix_display: "led_dot_matrix_displays",
  led_driver: "led_drivers",
  led_segment_display: "led_segment_displays",
  led_with_ic: "led_with_ics",
  oled_display: "oled_displays",
  pcie_m2_connector: "pcie_m2_connectors",
  potentiometer: "potentiometers",
  relay: "relays",
  resistor_array: "resistor_arrays",
  usb_c_connector: "usb_c_connectors",
  voltage_regulator: "voltage_regulators",
  wifi_module: "wifi_modules",
  wire_to_board_connector: "wire_to_board_connectors",
}
