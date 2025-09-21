import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface WifiModule extends BaseComponent {
  package: string
  core_processor: string | null
  antenna_type: string | null
  operating_voltage: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  sensitivity_dbm: number | null
  output_power_dbm: number | null
  frequency_ghz: number | null
  tx_current_ma: number | null
  rx_current_ma: number | null
  has_uart: boolean
  has_spi: boolean
  has_i2c: boolean
  has_gpio: boolean
  has_adc: boolean
  has_pwm: boolean
}

export const wifiModuleTableSpec: DerivedTableSpec<WifiModule> = {
  tableName: "wifi_module",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "core_processor", type: "text" },
    { name: "antenna_type", type: "text" },
    { name: "operating_voltage", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "sensitivity_dbm", type: "real" },
    { name: "output_power_dbm", type: "real" },
    { name: "frequency_ghz", type: "real" },
    { name: "tx_current_ma", type: "real" },
    { name: "rx_current_ma", type: "real" },
    { name: "has_uart", type: "boolean" },
    { name: "has_spi", type: "boolean" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_gpio", type: "boolean" },
    { name: "has_adc", type: "boolean" },
    { name: "has_pwm", type: "boolean" },
    { name: "is_basic", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([eb("categories.subcategory", "=", "WiFi Modules")]),
      ),
  mapToTable: (components) => {
    return components.map((c): WifiModule | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse operating voltage
      let voltage = null
      const rawVoltage = attrs["Operating Voltage"]
      if (rawVoltage) {
        const match = rawVoltage.match(/(\d+(?:\.\d+)?)V/)
        if (match) voltage = parseFloat(match[1])
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

      // Parse sensitivity
      let sensitivity = null
      const rawSensitivity = attrs["Sensitivity"]
      if (rawSensitivity) {
        const match = rawSensitivity.match(/([-\d]+)dBm/)
        if (match) sensitivity = parseInt(match[1])
      }

      // Parse output power
      let outputPower = null
      const rawPower = attrs["Output Power"]
      if (rawPower) {
        const match = rawPower.match(/(\d+)dBm/)
        if (match) outputPower = parseInt(match[1])
      }

      // Parse frequency
      let frequency = null
      const rawFreq = attrs["Frequency"]
      if (rawFreq) {
        const match = rawFreq.match(/(\d+(?:\.\d+)?)GHz/)
        if (match) frequency = parseFloat(match[1])
      }

      // Parse currents
      let txCurrent = null
      const rawTxCurrent = attrs["Send  Current"]
      if (rawTxCurrent) {
        const match = rawTxCurrent.match(/(\d+)mA/)
        if (match) txCurrent = parseInt(match[1])
      }

      let rxCurrent = null
      const rawRxCurrent = attrs["Receive  Current"]
      if (rawRxCurrent) {
        const match = rawRxCurrent.match(/(\d+)mA/)
        if (match) rxCurrent = parseInt(match[1])
      }

      // Parse interfaces
      const interfaces = (attrs["Support Interface"] || "").toLowerCase()
      const hasUart = interfaces.includes("uart")
      const hasSpi = interfaces.includes("spi")
      const hasI2c = interfaces.includes("i2c")
      const hasGpio = interfaces.includes("gpio")
      const hasAdc = interfaces.includes("adc")
      const hasPwm = interfaces.includes("pwm")

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        package: c.package || "",
        core_processor: attrs["Core Processor"] || null,
        antenna_type: attrs["Antenna Type"] || null,
        operating_voltage: voltage,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        sensitivity_dbm: sensitivity,
        output_power_dbm: outputPower,
        frequency_ghz: frequency,
        tx_current_ma: txCurrent,
        rx_current_ma: rxCurrent,
        has_uart: hasUart,
        has_spi: hasSpi,
        has_i2c: hasI2c,
        has_gpio: hasGpio,
        has_adc: hasAdc,
        has_pwm: hasPwm,
        attributes: attrs,
      }
    })
  },
}
