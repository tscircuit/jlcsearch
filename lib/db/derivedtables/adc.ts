import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Adc extends BaseComponent {
  // Extra columns
  package: string
  resolution_bits: number | null
  sampling_rate_hz: number | null
  num_channels: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  has_spi: boolean
  has_i2c: boolean
  has_parallel_interface: boolean
  has_serial_interface: boolean
  has_uart: boolean
  is_differential: boolean
  operating_temp_min: number | null
  operating_temp_max: number | null
}

export const adcTableSpec: DerivedTableSpec<Adc> = {
  tableName: "adc",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "resolution_bits", type: "integer" },
    { name: "sampling_rate_hz", type: "real" },
    { name: "num_channels", type: "integer" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "has_spi", type: "boolean" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_parallel_interface", type: "boolean" },
    { name: "has_serial_interface", type: "boolean" },
    { name: "has_uart", type: "boolean" },
    { name: "is_differential", type: "boolean" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
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
            "Analog To Digital Converters (ADCs)",
          ),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Adc | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes

      // Parse resolution
      let resolution = null
      const rawResolution = attrs["resolution"]
      if (rawResolution) {
        const match = rawResolution.match(/(\d+)Bit/)
        if (match) resolution = parseInt(match[1])
      }

      // Parse sampling rate
      let samplingRate = null
      const rawRate = attrs["sampling frequency"]
      if (rawRate) {
        const parsed = parseAndConvertSiUnit(rawRate).value
        if (parsed) samplingRate = parsed as number
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

      // Parse number of channels
      const numChannels = parseInt(attrs["number of channels"]) || null

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        package: c.package || "",
        resolution_bits: resolution,
        sampling_rate_hz: samplingRate,
        num_channels: numChannels,
        supply_voltage_min: voltageMin,
        supply_voltage_max: voltageMax,
        has_spi: (attrs["Interface"] || "").toLowerCase().includes("spi"),
        has_i2c: (attrs["Interface"] || "").toLowerCase().includes("i2c"),
        has_parallel_interface: (attrs["Interface"] || "")
          .toLowerCase()
          .includes("parallel"),
        has_serial_interface: (attrs["Interface"] || "")
          .toLowerCase()
          .includes("serial"),
        has_uart: (attrs["Interface"] || "").toLowerCase().includes("uart"),
        is_differential: attrs["differential input"] === "Yes",
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        attributes: attrs,
      }
    })
  },
}
