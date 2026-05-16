import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Imu extends BaseComponent {
  package: string
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  axes: string | null
  has_accelerometer: boolean
  has_gyroscope: boolean
  has_magnetometer: boolean
  has_i2c: boolean
  has_spi: boolean
  has_uart: boolean
}

export const imuTableSpec: DerivedTableSpec<Imu> = {
  tableName: "imu",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "axes", type: "text" },
    { name: "has_accelerometer", type: "boolean" },
    { name: "has_gyroscope", type: "boolean" },
    { name: "has_magnetometer", type: "boolean" },
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
          eb("categories.subcategory", "=", "Inertial Measurement Units"),
          eb("categories.subcategory", "=", "IMU"),
          eb(
            "categories.subcategory",
            "=",
            "Motion Sensors - Inertial Measurement Units",
          ),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Imu | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

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

      const axes = attrs["Axial Direction"] || attrs["Axis"] || null

      const interfaceStr = (
        attrs["Interface Type"] ||
        attrs["Interface"] ||
        ""
      ).toLowerCase()

      const hasI2c =
        interfaceStr.includes("i2c") ||
        interfaceStr.includes("i2c") ||
        interfaceStr.includes("iic") ||
        desc.includes("i2c")

      const hasSpi = interfaceStr.includes("spi") || desc.includes("spi")
      const hasUart = interfaceStr.includes("uart") || desc.includes("uart")

      const hasAccelerometer =
        desc.includes("accel") ||
        Boolean(attrs["Acceleration Range"]) ||
        Boolean(attrs["Accelerometer Range"])

      const hasGyroscope =
        desc.includes("gyro") ||
        Boolean(attrs["Gyroscope Range"]) ||
        Boolean(attrs["Angular Rate Range"])

      const hasMagnetometer =
        desc.includes("mag") ||
        desc.includes("compass") ||
        Boolean(attrs["Magnetic Range"]) ||
        Boolean(attrs["Geomagnetic Range"])

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
        supply_voltage_min: voltageMin,
        supply_voltage_max: voltageMax,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        axes,
        has_accelerometer: hasAccelerometer,
        has_gyroscope: hasGyroscope,
        has_magnetometer: hasMagnetometer,
        has_i2c: hasI2c,
        has_spi: hasSpi,
        has_uart: hasUart,
        attributes: attrs,
      }
    })
  },
}
