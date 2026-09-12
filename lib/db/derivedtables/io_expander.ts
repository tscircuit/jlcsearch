import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface IoExpander extends BaseComponent {
  // Extra columns
  package: string
  num_gpios: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  has_interrupt: boolean
  has_i2c: boolean
  has_spi: boolean
  has_smbus: boolean
  clock_frequency_hz: number | null
  output_type: string | null
  sink_current_ma: number | null
  source_current_ma: number | null
}

export const ioExpanderTableSpec: DerivedTableSpec<IoExpander> = {
  tableName: "io_expander",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "num_gpios", type: "integer" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "has_interrupt", type: "boolean" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_spi", type: "boolean" },
    { name: "has_smbus", type: "boolean" },
    { name: "clock_frequency_hz", type: "real" },
    { name: "output_type", type: "text" },
    { name: "sink_current_ma", type: "real" },
    { name: "source_current_ma", type: "real" },
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
        eb.or([eb("categories.subcategory", "=", "I/O Expanders")]),
      ),
  mapToTable: (components) => {
    return components.map((c): IoExpander | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

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

      // Parse number of GPIOs
      let numGpios = null
      const rawGpios = attrs["Number of I/O"] || attrs["Number of GPIOs"]
      if (rawGpios) {
        const match = rawGpios.match(/(\d+)/)
        if (match) numGpios = parseInt(match[1])
      }

      // Parse clock frequency
      let clockFreq = null
      const rawClock = attrs["Clock Frequency"]
      if (rawClock) {
        const parsed = parseAndConvertSiUnit(rawClock).value
        if (parsed) clockFreq = parsed as number
      }

      // Parse current ratings
      let sinkCurrent = null
      const rawSink = attrs["Output Sink Current"]
      if (rawSink) {
        const parsed = parseAndConvertSiUnit(rawSink).value
        if (parsed) sinkCurrent = (parsed as number) * 1000 // Convert to mA
      }

      let sourceCurrent = null
      const rawSource = attrs["Output Source current"]
      if (rawSource) {
        const parsed = parseAndConvertSiUnit(rawSource).value
        if (parsed) sourceCurrent = (parsed as number) * 1000 // Convert to mA
      }

      // Determine interfaces
      const interfaceType = (attrs["Interface"] || "").toLowerCase()
      const hasI2c =
        interfaceType.includes("i²c") || interfaceType.includes("i2c")
      const hasSpi = interfaceType.includes("spi")
      const hasSmbus = interfaceType.includes("smbus")

      // Determine if it has interrupt output
      const hasInterrupt = Boolean(
        attrs["Interrupt Output"]?.toLowerCase().includes("with") ||
          desc.includes("interrupt") ||
          desc.includes("irq"),
      )

      // Get output type
      const outputType = attrs["Output Type"] || null

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        is_extended_promotional: Boolean(c.extended_promotional),
        package: c.package || "",
        num_gpios: numGpios,
        supply_voltage_min: voltageMin,
        supply_voltage_max: voltageMax,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        has_interrupt: hasInterrupt,
        has_i2c: hasI2c,
        has_spi: hasSpi,
        has_smbus: hasSmbus,
        clock_frequency_hz: clockFreq,
        output_type: outputType,
        sink_current_ma: sinkCurrent,
        source_current_ma: sourceCurrent,
        attributes: attrs,
      }
    })
  },
}
