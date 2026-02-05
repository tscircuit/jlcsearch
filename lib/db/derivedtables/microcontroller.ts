import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Microcontroller extends BaseComponent {
  // Extra columns
  package: string
  cpu_core: string | null
  cpu_speed_hz: number | null
  flash_size_bytes: number | null
  ram_size_bytes: number | null
  eeprom_size_bytes: number | null
  gpio_count: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  has_uart: boolean
  has_i2c: boolean
  has_spi: boolean
  has_can: boolean
  has_usb: boolean
  has_adc: boolean
  has_dac: boolean
  has_pwm: boolean
  has_dma: boolean
  has_rtc: boolean
  has_comparator: boolean
  has_watchdog: boolean
  adc_resolution_bits: number | null
  dac_resolution_bits: number | null
}

export const microcontrollerTableSpec: DerivedTableSpec<Microcontroller> = {
  tableName: "microcontroller",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "cpu_core", type: "text" },
    { name: "cpu_speed_hz", type: "real" },
    { name: "flash_size_bytes", type: "real" },
    { name: "ram_size_bytes", type: "real" },
    { name: "eeprom_size_bytes", type: "real" },
    { name: "gpio_count", type: "integer" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "has_uart", type: "boolean" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_spi", type: "boolean" },
    { name: "has_can", type: "boolean" },
    { name: "has_usb", type: "boolean" },
    { name: "has_adc", type: "boolean" },
    { name: "has_dac", type: "boolean" },
    { name: "has_pwm", type: "boolean" },
    { name: "has_dma", type: "boolean" },
    { name: "has_rtc", type: "boolean" },
    { name: "has_comparator", type: "boolean" },
    { name: "has_watchdog", type: "boolean" },
    { name: "adc_resolution_bits", type: "integer" },
    { name: "dac_resolution_bits", type: "integer" },
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
          eb(
            "categories.subcategory",
            "=",
            "Microcontroller Units (MCUs/MPUs/SOCs)",
          ),
          eb("categories.subcategory", "=", "MICROCHIP"),
          eb("categories.subcategory", "=", "ST Microelectronics"),
          eb("categories.subcategory", "=", "NXP MCU"),
          eb("categories.subcategory", "=", "CYPRESS"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Microcontroller | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse CPU core and speed
      const cpuCore = attrs["CPU Core"] || null
      let cpuSpeed = null
      const rawSpeed = attrs["CPU Maximum Speed"]
      if (rawSpeed) {
        const match = rawSpeed.match(/(\d+)MHz/)
        if (match) cpuSpeed = parseInt(match[1]) * 1e6 // Convert to Hz
      }

      // Parse memory sizes
      let flashSize = null
      const rawFlash = attrs["Program Storage Size"] || attrs["FLASH Size"]
      if (rawFlash) {
        const parsed = parseAndConvertSiUnit(rawFlash).value
        if (parsed) flashSize = parsed as number
      }

      let ramSize = null
      const rawRam = attrs["RAM Size"]
      if (rawRam) {
        const parsed = parseAndConvertSiUnit(rawRam).value
        if (parsed) ramSize = parsed as number
      }

      let eepromSize = null
      const rawEeprom = attrs["EEPROM"]
      if (rawEeprom) {
        const parsed = parseAndConvertSiUnit(rawEeprom).value
        if (parsed) eepromSize = parsed as number
      }

      // Parse GPIO count
      const gpioCount = parseInt(attrs["GPIO Ports Number"]) || null

      // Parse voltage range
      let voltageMin = null
      let voltageMax = null
      const rawVoltage =
        attrs["Operating Voltage Range"] || attrs["Supply Voltage"]
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
      const rawTemp = attrs["Operating Temperature Range"]
      if (rawTemp) {
        const match = rawTemp.match(/([-\d]+)℃~\+([-\d]+)℃/)
        if (match) {
          tempMin = parseInt(match[1])
          tempMax = parseInt(match[2])
        }
      }

      // Parse peripheral features
      const peripheral = (attrs["Peripheral/Function"] || "").toLowerCase()
      const hasUart = Boolean(
        peripheral.includes("uart") ||
          attrs["UART/USART"]?.includes("1") ||
          desc.includes("uart"),
      )
      const hasI2c = Boolean(
        peripheral.includes("i2c") ||
          attrs["I2C"]?.includes("1") ||
          desc.includes("i2c"),
      )
      const hasSpi = Boolean(
        peripheral.includes("spi") ||
          attrs["SPI"]?.includes("1") ||
          desc.includes("spi"),
      )
      const hasCan = Boolean(
        peripheral.includes("can") ||
          attrs["CAN"]?.includes("1") ||
          desc.includes("can"),
      )
      const hasUsb = Boolean(
        peripheral.includes("usb") ||
          attrs["Universal Serial Bus"] === "Yes" ||
          desc.includes("usb"),
      )
      const hasAdc = Boolean(attrs["ADC (Bit)"] || desc.includes("adc"))
      const hasDac = Boolean(attrs["DAC (Bit)"] || desc.includes("dac"))
      const hasPwm = Boolean(
        peripheral.includes("pwm") ||
          attrs["PWM (Bit)"] ||
          desc.includes("pwm"),
      )
      const hasDma = Boolean(
        peripheral.includes("dma") ||
          attrs["Direct Memory Access"] === "Yes" ||
          desc.includes("dma"),
      )
      const hasRtc = Boolean(
        peripheral.includes("rtc") ||
          attrs["Real-Time Clock"] === "Yes" ||
          desc.includes("rtc"),
      )
      const hasComparator = Boolean(
        peripheral.includes("comparator") ||
          attrs["Internal Comparator"] === "Yes" ||
          desc.includes("comparator"),
      )
      const hasWatchdog = Boolean(
        peripheral.includes("wdt") ||
          attrs["Watchdog"] === "Yes" ||
          desc.includes("watchdog"),
      )

      // Parse ADC/DAC resolution
      let adcResolution = null
      const rawAdc = attrs["ADC (Bit)"]
      if (rawAdc) {
        const match = rawAdc.match(/(\d+)bit/)
        if (match) adcResolution = parseInt(match[1])
      }

      let dacResolution = null
      const rawDac = attrs["DAC (Bit)"]
      if (rawDac) {
        const match = rawDac.match(/(\d+)bit/)
        if (match) dacResolution = parseInt(match[1])
      }

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
        cpu_core: cpuCore,
        cpu_speed_hz: cpuSpeed,
        flash_size_bytes: flashSize,
        ram_size_bytes: ramSize,
        eeprom_size_bytes: eepromSize,
        gpio_count: gpioCount,
        supply_voltage_min: voltageMin,
        supply_voltage_max: voltageMax,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        has_uart: hasUart,
        has_i2c: hasI2c,
        has_spi: hasSpi,
        has_can: hasCan,
        has_usb: hasUsb,
        has_adc: hasAdc,
        has_dac: hasDac,
        has_pwm: hasPwm,
        has_dma: hasDma,
        has_rtc: hasRtc,
        has_comparator: hasComparator,
        has_watchdog: hasWatchdog,
        adc_resolution_bits: adcResolution,
        dac_resolution_bits: dacResolution,
        attributes: attrs,
      }
    })
  },
}
