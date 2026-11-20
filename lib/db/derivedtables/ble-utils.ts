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

const parsePositiveVoltages = (value: string | null): number[] => {
  if (!value) return []

  const matches = value.matchAll(/(?<![-\d])(\d+(?:\.\d+)?)\s*V\b/gi)
  return Array.from(matches, (match) => Number(match[1])).filter(
    (v) => Number.isFinite(v) && v > 0,
  )
}

const parseFrequencyGhz = (
  value: string | null,
  allowLowUnits = true,
): number | null => {
  if (!value) return null

  const pattern = allowLowUnits
    ? /(\d+(?:\.\d+)?)\s*(GHz|MHz|kHz|Hz)\b/i
    : /(\d+(?:\.\d+)?)\s*(GHz|MHz)\b/i
  const match = value.match(pattern)
  if (!match) return null

  const frequency = Number(match[1])
  if (!Number.isFinite(frequency)) return null
  const unit = match[2]!.toLowerCase()
  if (unit === "ghz") return frequency
  if (unit === "mhz") return frequency / 1e3
  if (unit === "khz") return frequency / 1e6
  return frequency / 1e9
}

const parseDataRateMbps = (value: string | null): number | null => {
  if (!value) return null

  const rates: number[] = []
  for (const match of value.matchAll(
    /(\d+(?:\.\d+)?)\s*(Gbps|Mbps|Kbps|bps)\b/gi,
  )) {
    const dataRate = Number(match[1])
    if (!Number.isFinite(dataRate)) continue
    const unit = match[2]!.toLowerCase()
    if (unit === "gbps") rates.push(dataRate * 1e3)
    else if (unit === "mbps") rates.push(dataRate)
    else if (unit === "kbps") rates.push(dataRate / 1e3)
    else rates.push(dataRate / 1e6)
  }
  return rates.length > 0 ? Math.max(...rates) : null
}

const parseBluetoothVersion = (
  rawAttribute: string | null,
  rawDescription: string,
): string | null => {
  if (rawAttribute) {
    const candidates = Array.from(
      rawAttribute.matchAll(
        /(?:bluetooth|ble)?\s*(?:version|v)?\s*(\d+(?:\.\d+)?)/gi,
      ),
      (m) => m[1]!,
    ).filter((v) => Number.isFinite(Number(v)))
    if (candidates.length > 0) {
      return candidates.reduce((best, cur) =>
        Number(cur) > Number(best) ? cur : best,
      )
    }
    return rawAttribute
  }

  const descCandidates = Array.from(
    rawDescription.matchAll(
      /\b(?:bluetooth|ble)\s*(?:version\s*|v)?(\d+(?:\.\d+)?)\b/gi,
    ),
    (m) => m[1]!,
  ).filter((v) => Number.isFinite(Number(v)))
  if (descCandidates.length > 0) {
    return descCandidates.reduce((best, cur) =>
      Number(cur) > Number(best) ? cur : best,
    )
  }
  return null
}

const normalizeCoreProcessor = (value: string | null): string | null => {
  if (!value) return null
  const stripped = value.replace(/\s+chips?$/i, "").trim()
  return stripped && stripped !== "-" ? stripped : null
}

export const readComponentAttributes = (
  extra: string | null | undefined,
): Record<string, unknown> | null => {
  if (!extra) return {}

  try {
    const parsed = JSON.parse(extra)
    if (!parsed || typeof parsed !== "object") return null
    if (!parsed.attributes || typeof parsed.attributes !== "object") {
      return {}
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

  if (/\bbluetooth\b|\bble\b/i.test(component.description)) {
    return true
  }

  return /\b(?:n?rf5\d+|cc(?:135[24]|254|264|265|267|234)\d*|efr32(?:bg|mg)\d+|bluenrg|stm32wba?|n32wb|ch5[789]|gr55|qn90|rsl10|da14\d+|ra4w1|tlsr\d+|esp32)/i.test(
    searchableText,
  )
}

export const isLikelyBareBleChip = (
  component: Pick<SourceComponent, "package">,
): boolean => {
  const packageName = (component.package ?? "").trim()
  return /^(?:[A-Z]*QFN|[A-Z]*QFPN|[A-Z]*BGA|WLCSP|CSP|DFN|LQFP|TQFP|QFP|SOIC|SOP|SSOP|TSSOP)(?:-|\b)/i.test(
    packageName,
  )
}

export const mapBleFields = (
  component: SourceComponent,
  attributes: Record<string, unknown>,
): BleComponentFields => {
  const rawDesc = component.description ?? ""
  const rawVoltage = getFirstAttribute(attributes, [
    "Operating Voltage",
    "Operating Voltage Range",
    "Voltage - Supply",
    "Supply Voltage",
    "Working Voltage",
    "mains input",
  ])
  const attrVoltages = parsePositiveVoltages(rawVoltage)
  const voltages =
    attrVoltages.length > 0 ? attrVoltages : parsePositiveVoltages(rawDesc)

  const attrInterfaceText = [
    "Support Interface",
    "Interface",
    "Interface Type",
    "interface type",
    "Peripheral/Function",
  ]
    .map((key) => attributes[key])
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
  const interfaceText = (attrInterfaceText || rawDesc).toLowerCase()

  const rawBluetoothVersion = getFirstAttribute(attributes, [
    "Bluetooth Version",
    "Bluetooth Protocol",
    "Bluetooth Standard",
    "Wireless Standard",
  ])

  const rawFrequency = getFirstAttribute(attributes, [
    "Frequency",
    "Frequency Range",
    "Typical Application Frequency",
    "Working Frequency",
  ])

  const rawDataRate = getFirstAttribute(attributes, [
    "Data Rate",
    "Transmission Rate",
    "transmission rate",
  ])

  return {
    lcsc: component.lcsc,
    mfr: component.mfr,
    description: rawDesc,
    stock: component.stock,
    price1: null,
    in_stock: component.stock > 0,
    is_basic: Boolean(component.basic),
    is_preferred: Boolean(component.preferred),
    package: component.package || "",
    core_processor: normalizeCoreProcessor(
      getFirstAttribute(attributes, [
        "Core Processor",
        "Core IC",
        "Core  IC",
        "CPU Core",
        "Core",
        "Chip Model",
        "Utilized IC / Part",
        "IC / Part",
      ]),
    ),
    bluetooth_version: parseBluetoothVersion(rawBluetoothVersion, rawDesc),
    frequency_ghz:
      parseFrequencyGhz(rawFrequency, true) ??
      parseFrequencyGhz(rawDesc, false),
    operating_voltage_min: voltages.length > 0 ? Math.min(...voltages) : null,
    operating_voltage_max: voltages.length > 0 ? Math.max(...voltages) : null,
    data_rate_mbps:
      parseDataRateMbps(rawDataRate) ?? parseDataRateMbps(rawDesc),
    has_uart: interfaceText.includes("uart") || interfaceText.includes("usart"),
    has_i2c: interfaceText.includes("i2c") || interfaceText.includes("i²c"),
    has_spi: interfaceText.includes("spi"),
    has_usb: interfaceText.includes("usb"),
    attributes: Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [key, String(value)]),
    ),
  }
}
