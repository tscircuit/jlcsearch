import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface AnalogMultiplexer extends BaseComponent {
  // Extra columns
  package: string
  num_channels: number | null
  num_bits: number | null
  on_resistance_ohms: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  has_enable: boolean
  has_spi: boolean
  has_i2c: boolean
  has_parallel_interface: boolean
  leakage_current_na: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  channel_type: "single" | "differential" | "unknown"
}

export const analogMultiplexerTableSpec: DerivedTableSpec<AnalogMultiplexer> = {
  tableName: "analog_multiplexer",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "num_channels", type: "integer" },
    { name: "num_bits", type: "integer" },
    { name: "on_resistance_ohms", type: "real" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "has_enable", type: "boolean" },
    { name: "has_spi", type: "boolean" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_parallel_interface", type: "boolean" },
    { name: "leakage_current_na", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "channel_type", type: "text" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "Analog Switches, Multiplexers"),
          eb("categories.subcategory", "=", "Analog Switches / Multiplexers"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): AnalogMultiplexer | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse number of channels
      let numChannels = null
      const rawChannels = attrs["Number of Channels"]
      if (rawChannels) {
        const match = rawChannels.match(/(\d+)/)
        if (match) numChannels = parseInt(match[1])
      }

      // Parse number of bits (address lines)
      let numBits = null
      if (numChannels) {
        numBits = Math.ceil(Math.log2(numChannels))
      }

      // Parse on-state resistance
      let onResistance = null
      const rawResistance = attrs["On-State Resistance (Max)"]
      if (rawResistance) {
        const match = rawResistance.match(/(\d+(?:\.\d+)?)Ω/)
        if (match) onResistance = parseFloat(match[1])
      }

      // Parse voltage range
      let voltageMin = null
      let voltageMax = null
      const rawVoltage = attrs["Supply Voltage"]
      if (rawVoltage) {
        const match = rawVoltage.match(/([\d.]+)V~([\d.]+)V/)
        if (match) {
          voltageMin = parseFloat(match[1])
          voltageMax = parseFloat(match[2])
        }
      }

      // Parse leakage current
      let leakageCurrent = null
      const rawLeakage = attrs["Leakage Current"]
      if (rawLeakage) {
        const parsed = parseAndConvertSiUnit(rawLeakage).value as number
        if (parsed) leakageCurrent = parsed * 1e9 // Convert to nanoamps
      }

      // Parse temperature range
      let tempMin = null
      let tempMax = null
      const rawTemp = attrs["Operating Temperature"]
      if (rawTemp) {
        const match = rawTemp.match(/([-\d]+)℃~\+([-\d]+)℃/)
        if (match) {
          tempMin = parseInt(match[1])
          tempMax = parseInt(match[2])
        }
      }

      // Determine channel type
      let channelType: "single" | "differential" | "unknown" = "unknown"
      if (desc.includes("differential")) {
        channelType = "differential"
      } else if (desc.includes("single")) {
        channelType = "single"
      }

      // Parse interface and control features
      const hasEnable = Boolean(
        attrs["Enable/Disable"] === "Yes" ||
          desc.includes("enable") ||
          desc.includes("en pin"),
      )

      const interfaceType = (attrs["Interface"] || "").toLowerCase()
      const hasI2c = interfaceType.includes("i2c")
      const hasSpi = interfaceType.includes("spi")
      const hasParallel = interfaceType.includes("parallel")

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        is_extended_promotional: false, // TODO: Populate from JLCPCB promotional data
        package: c.package || "",
        num_channels: numChannels,
        num_bits: numBits,
        on_resistance_ohms: onResistance,
        supply_voltage_min: voltageMin,
        supply_voltage_max: voltageMax,
        has_enable: hasEnable,
        has_spi: hasSpi,
        has_i2c: hasI2c,
        has_parallel_interface: hasParallel,
        leakage_current_na: leakageCurrent,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        channel_type: channelType,
        attributes: attrs,
      }
    })
  },
}
