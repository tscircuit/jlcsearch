import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Dac extends BaseComponent {
  // Extra columns
  package: string
  resolution_bits: number | null
  num_channels: number | null
  settling_time_us: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  has_spi: boolean
  has_i2c: boolean
  has_parallel_interface: boolean
  output_type: string | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  nonlinearity_lsb: number | null
}

export const dacTableSpec: DerivedTableSpec<Dac> = {
  tableName: "dac",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "resolution_bits", type: "integer" },
    { name: "num_channels", type: "integer" },
    { name: "settling_time_us", type: "real" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "has_spi", type: "boolean" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_parallel_interface", type: "boolean" },
    { name: "output_type", type: "text" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "nonlinearity_lsb", type: "real" },
    { name: "is_basic", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb(
            "categories.subcategory",
            "=",
            "Digital To Analog Converters (DACs)",
          ),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Dac | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse resolution
      let resolution = null
      const rawResolution = attrs["Resolution"]
      if (rawResolution) {
        const match = rawResolution.match(/(\d+)\s*Bits?/)
        if (match) resolution = parseInt(match[1])
      }

      // Parse number of channels
      const numChannels = parseInt(attrs["Number of Channels"]) || null

      // Parse settling time
      let settlingTime = null
      const rawSettling = attrs["Settling Time"]
      if (rawSettling) {
        const match = rawSettling.match(/(\d+(?:\.\d+)?)\s*us/)
        if (match) settlingTime = parseFloat(match[1])
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

      // Parse nonlinearity
      let nonlinearity = null
      const rawNonlinearity = attrs["Integral nonlinearity"]
      if (rawNonlinearity) {
        const match = rawNonlinearity.match(/±([\d.]+)LSB/)
        if (match) nonlinearity = parseFloat(match[1])
      }

      // Determine interfaces
      const interfaceType = (attrs["Interface"] || "").toLowerCase()
      const hasI2c =
        interfaceType.includes("i²c") || interfaceType.includes("i2c")
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
        package: c.package || "",
        resolution_bits: resolution,
        num_channels: numChannels,
        settling_time_us: settlingTime,
        supply_voltage_min: voltageMin,
        supply_voltage_max: voltageMax,
        has_spi: hasSpi,
        has_i2c: hasI2c,
        has_parallel_interface: hasParallel,
        output_type: attrs["Output Type"] || null,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        nonlinearity_lsb: nonlinearity,
        attributes: attrs,
      }
    })
  },
}
