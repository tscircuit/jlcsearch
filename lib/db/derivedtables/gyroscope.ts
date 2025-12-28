import { getIsExtendedPromotional } from "lib/util/component-utils"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Gyroscope extends BaseComponent {
  package: string
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  axes: string | null
  has_i2c: boolean
  has_spi: boolean
  has_uart: boolean
}

export const gyroscopeTableSpec: DerivedTableSpec<Gyroscope> = {
  tableName: "gyroscope",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "axes", type: "text" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_spi", type: "boolean" },
    { name: "has_uart", type: "boolean" },
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
          eb("categories.subcategory", "=", "Attitude Sensors"),
          eb("categories.subcategory", "=", "Attitude Sensor/Gyroscope"),
          eb("categories.subcategory", "=", "Angular Velocity Sensors"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Gyroscope | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse voltage range
      let voltageMin: number | null = null
      let voltageMax: number | null = null
      const rawVoltage = attrs["Supply Voltage"]
      if (rawVoltage) {
        const match = rawVoltage.match(/([\d.]+)V~([\d.]+)V/)
        if (match) {
          voltageMin = parseFloat(match[1])
          voltageMax = parseFloat(match[2])
        } else {
          const single = rawVoltage.match(/([\d.]+)V/)
          if (single) {
            voltageMin = voltageMax = parseFloat(single[1])
          }
        }
      }

      // Parse temperature range
      let tempMin: number | null = null
      let tempMax: number | null = null
      const rawTemp = attrs["Operating Temperature"]
      if (rawTemp) {
        const match = rawTemp.match(/([-\d]+)℃~\+([-\d]+)℃/)
        if (match) {
          tempMin = parseInt(match[1])
          tempMax = parseInt(match[2])
        }
      }

      // Parse axes information
      const axes = attrs["Axial Direction"] || null

      const interfaceStr = (
        attrs["Interface Type"] ||
        attrs["Interface"] ||
        ""
      ).toLowerCase()

      const hasI2c =
        interfaceStr.includes("i2c") ||
        interfaceStr.includes("i²c") ||
        interfaceStr.includes("iic") ||
        desc.includes("i2c")

      const hasSpi = interfaceStr.includes("spi") || desc.includes("spi")
      const hasUart = interfaceStr.includes("uart") || desc.includes("uart")

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        is_extended_promotional: getIsExtendedPromotional(c),
        package: c.package || "",
        supply_voltage_min: voltageMin,
        supply_voltage_max: voltageMax,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        axes,
        has_i2c: hasI2c,
        has_spi: hasSpi,
        has_uart: hasUart,
        attributes: attrs,
      }
    })
  },
}
