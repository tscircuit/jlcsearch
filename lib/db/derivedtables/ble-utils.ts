import type { BaseComponent } from "./component-base"

interface SourceComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
  basic: number
  preferred: number
  package: string
}

export interface BleComponentFields extends BaseComponent {
  package: string
  core_processor: string | null
  bluetooth_version: string | null
  frequency_ghz: number | null
  operating_voltage_min: number | null
  operating_voltage_max: number | null
  data_rate_mbps: number | null
  has_uart: boolean
  has_i2c: boolean
  has_spi: boolean
  has_usb: boolean
}

const getFirstAttribute = (
  attributes: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = attributes[key]
    if (value === undefined || value === null) continue

    const normalized = String(value).trim()
    if (normalized && normalized !== "-") return normalized
  }

  return null
}

const parseValuesWithUnit = (value: string | null, unit: string): number[] => {
  if (!value) return []

  const matches = value.matchAll(
    new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${unit}`, "gi"),
  )
  return Array.from(matches, (match) => Number(match[1])).filter(
    Number.isFinite,
  )
}

const parseFrequencyGhz = (value: string | null): number | null => {
  if (!value) return null

  const match = value.match(/(-?\d+(?:\.\d+)?)\s*(GHz|MHz|kHz|Hz)/i)
  if (!match) return null

  const frequency = Number(match[1])
  const unit = match[2].toLowerCase()
  if (unit === "ghz") return frequency
  if (unit === "mhz") return frequency / 1e3
  if (unit === "khz") return frequency / 1e6
  return frequency / 1e9
}

const parseDataRateMbps = (value: string | null): number | null => {
  if (!value) return null

  const match = value.match(/(\d+(?:\.\d+)?)\s*(Gbps|Mbps|Kbps|bps)/i)
  if (!match) return null

  const dataRate = Number(match[1])
  const unit = match[2].toLowerCase()
  if (unit === "gbps") return dataRate * 1e3
  if (unit === "mbps") return dataRate
  if (unit === "kbps") return dataRate / 1e3
  return dataRate / 1e6
}

const parseBluetoothVersion = (value: string | null): string | null => {
  if (!value) return null

  const versionMatch = value.match(
    /(?:bluetooth|ble)?\s*(?:version|v)?\s*(\d+(?:\.\d+)?)/i,
  )
  return versionMatch?.[1] ?? value
}

export const readComponentAttributes = (
  extra: string | null,
): Record<string, unknown> | null => {
  if (!extra) return null

  try {
    const parsed = JSON.parse(extra)
    if (!parsed.attributes || typeof parsed.attributes !== "object") {
      return null
    }
    return parsed.attributes
  } catch {
    return null
  }
}

export const isBleChip = (
  component: Pick<SourceComponent, "description" | "mfr">,
  attributes: Record<string, unknown>,
): boolean => {
  const bluetoothMetadata = [
    "Applications",
    "Bluetooth Version",
    "Bluetooth Protocol",
    "Bluetooth Standard",
    "Protocol",
    "Wireless Standard",
  ]
    .map((key) => attributes[key])
    .filter((value) => value !== undefined && value !== null)
    .join(" ")

  if (/bluetooth|\bble\b|low[ -]?energy/i.test(bluetoothMetadata)) {
    return true
  }

  const searchableText = `${component.mfr} ${component.description}`
  if (/\besp32-(?:s2|p4)/i.test(searchableText)) return false

  return /\b(?:n?rf5\d+|cc(?:135[24]|254|264|265|267)\d*|efr32(?:bg|mg)\d+|bluenrg|stm32wba?|n32wb|ch5[789]|gr55|qn90|rsl10|da14\d+|ra4w1|tlsr\d+|esp32)/i.test(
    searchableText,
  )
}

export const isLikelyBareBleChip = (
  component: Pick<SourceComponent, "package">,
): boolean => {
  const packageName = component.package.trim()
  return /^(?:[A-Z]*QFN|[A-Z]*QFPN|[A-Z]*BGA|WLCSP|CSP|DFN|LQFP|TQFP|QFP|SOIC|SOP|SSOP|TSSOP)(?:-|\b)/i.test(
    packageName,
  )
}

export const mapBleFields = (
  component: SourceComponent,
  attributes: Record<string, unknown>,
): BleComponentFields => {
  const rawVoltage = getFirstAttribute(attributes, [
    "Operating Voltage",
    "Operating Voltage Range",
    "Supply Voltage",
    "Working Voltage",
    "mains input",
  ])
  const voltages = parseValuesWithUnit(rawVoltage, "V")

  const interfaceText = [
    "Support Interface",
    "Interface",
    "Interface Type",
    "interface type",
    "Peripheral/Function",
  ]
    .map((key) => attributes[key])
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase()

  const rawBluetoothVersion = getFirstAttribute(attributes, [
    "Bluetooth Version",
    "Bluetooth Protocol",
    "Bluetooth Standard",
    "Wireless Standard",
  ])

  return {
    lcsc: component.lcsc,
    mfr: component.mfr,
    description: component.description,
    stock: component.stock,
    price1: null,
    in_stock: component.stock > 0,
    is_basic: Boolean(component.basic),
    is_preferred: Boolean(component.preferred),
    is_extended_promotional: Boolean(component.preferred && !component.basic),
    package: component.package || "",
    core_processor: getFirstAttribute(attributes, [
      "Core Processor",
      "Core IC",
      "CPU Core",
      "Core",
      "Chip Model",
    ]),
    bluetooth_version: parseBluetoothVersion(rawBluetoothVersion),
    frequency_ghz: parseFrequencyGhz(
      getFirstAttribute(attributes, [
        "Frequency",
        "Frequency Range",
        "Typical Application Frequency",
        "Working Frequency",
      ]),
    ),
    operating_voltage_min: voltages.length > 0 ? Math.min(...voltages) : null,
    operating_voltage_max: voltages.length > 0 ? Math.max(...voltages) : null,
    data_rate_mbps: parseDataRateMbps(
      getFirstAttribute(attributes, [
        "Data Rate",
        "Transmission Rate",
        "transmission rate",
      ]),
    ),
    has_uart: interfaceText.includes("uart"),
    has_i2c: interfaceText.includes("i2c"),
    has_spi: interfaceText.includes("spi"),
    has_usb: interfaceText.includes("usb"),
    attributes: Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [key, String(value)]),
    ),
  }
}
