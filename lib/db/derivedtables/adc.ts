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

const ADC_SUBCATEGORIES = [
  "Analog To Digital Converters (ADCs)",
  "Analog To Digital Converters (ADC)",
  "Analog to Digital Converters (ADCs)",
  "Analog to Digital Converters (ADC)",
] as const

const parseExtraJson = (
  rawExtra: string | null | undefined,
): Record<string, any> => {
  if (!rawExtra) return {}
  try {
    const parsed = JSON.parse(rawExtra)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const parseResolutionBits = (
  rawAttr: string | null | undefined,
  rawDesc: string,
): number | null => {
  if (rawAttr) {
    const tokens = String(rawAttr).match(/\d+/g)
    if (tokens) {
      const valid = tokens
        .map((token) => Number.parseInt(token, 10))
        .filter((bits) => Number.isFinite(bits) && bits >= 1 && bits <= 64)
      if (valid.length > 0) return Math.max(...valid)
    }
  }
  const descMatch = rawDesc.match(/\b(\d+)\s*-?\s*Bits?\b/i)
  if (descMatch) {
    const parsed = Number.parseInt(descMatch[1]!, 10)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 64) return parsed
  }
  return null
}

const parseRateTokensHz = (raw: string, unitPattern: RegExp): number | null => {
  const rates: number[] = []
  for (const match of raw.matchAll(unitPattern)) {
    const amount = Number.parseFloat(match[1]!)
    if (!Number.isFinite(amount)) continue
    const prefix = match[2] ?? ""
    const multiplier =
      prefix === "G"
        ? 1e9
        : prefix === "M"
          ? 1e6
          : prefix === "k" || prefix === "K"
            ? 1e3
            : 1
    rates.push(Number((amount * multiplier).toPrecision(12)))
  }
  return rates.length > 0 ? Math.max(...rates) : null
}

const parseSamplingRateHz = (
  rawAttr: string | null | undefined,
  rawDesc: string,
): number | null => {
  if (rawAttr) {
    const rawStr = String(rawAttr)
    const fromTokens = parseRateTokensHz(
      rawStr,
      /(\d+(?:\.\d+)?)\s*([kKMG])?\s*(?:Hz|SPS)\b/gi,
    )
    if (fromTokens !== null) return fromTokens
    try {
      const parsed = parseAndConvertSiUnit(rawStr).value
      if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed
    } catch {}
  }
  return parseRateTokensHz(rawDesc, /(\d+(?:\.\d+)?)\s*([kKMG])?\s*SPS\b/gi)
}

const parseSupplyVoltageRange = (
  rawAttr: string | null | undefined,
  rawDesc: string,
): { min: number | null; max: number | null } => {
  if (rawAttr) {
    const matches = [...String(rawAttr).matchAll(/(\d+(?:\.\d+)?)\s*V\b/gi)]
    const values = matches
      .map((match) => Number.parseFloat(match[1]!))
      .filter(Number.isFinite)
    if (values.length > 0) {
      return { min: Math.min(...values), max: Math.max(...values) }
    }
  }
  const descMatch = rawDesc.match(/(\d+(?:\.\d+)?)V~(\d+(?:\.\d+)?)V/)
  if (descMatch) {
    const first = Number.parseFloat(descMatch[1]!)
    const second = Number.parseFloat(descMatch[2]!)
    if (Number.isFinite(first) && Number.isFinite(second)) {
      return { min: Math.min(first, second), max: Math.max(first, second) }
    }
  }
  return { min: null, max: null }
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
        eb.or(
          ADC_SUBCATEGORIES.map((subcategory) =>
            eb("categories.subcategory", "=", subcategory),
          ),
        ),
      ),
  mapToTable: (components) => {
    return components.map((c): Adc | null => {
      const extra = parseExtraJson(c.extra)
      const attrs: Record<string, string> =
        extra.attributes && typeof extra.attributes === "object"
          ? extra.attributes
          : {}
      const rawDesc = c.description ?? ""

      const resolution = parseResolutionBits(
        attrs["Resolution (Bits)"] ||
          attrs["Resolution(Bits)"] ||
          attrs["Resolution"] ||
          attrs["resolution"],
        rawDesc,
      )

      const samplingRate = parseSamplingRateHz(
        attrs["Sampling Rate"] ||
          attrs["sampling frequency"] ||
          attrs["Sampling Frequency"],
        rawDesc,
      )

      const { min: voltageMin, max: voltageMax } = parseSupplyVoltageRange(
        attrs["Voltage - Supply"] || attrs["Supply Voltage"],
        rawDesc,
      )

      let tempMin: number | null = null
      let tempMax: number | null = null
      const rawTemp = attrs["Operating Temperature"] || rawDesc
      if (rawTemp) {
        const match = String(rawTemp).match(/([-\d]+)℃~\+?([-\d]+)℃/)
        if (match) {
          tempMin = Number.parseInt(match[1]!, 10)
          tempMax = Number.parseInt(match[2]!, 10)
        }
      }

      const rawChannels =
        attrs["Number of Channels"] || attrs["number of channels"]
      const parsedChannels = rawChannels
        ? Number.parseInt(String(rawChannels), 10)
        : Number.NaN
      const numChannels =
        Number.isFinite(parsedChannels) && parsedChannels > 0
          ? parsedChannels
          : null

      const rawInterface = attrs["Interface"] || attrs["Interface Type"] || ""
      const interfaceText = (rawInterface || rawDesc).toLowerCase()
      const rawDiff = String(
        attrs["differential input"] ?? attrs["Differential Input"] ?? "",
      ).trim()

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: rawDesc,
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
        has_spi: interfaceText.includes("spi"),
        has_i2c: interfaceText.includes("i2c") || interfaceText.includes("i²c"),
        has_parallel_interface: interfaceText.includes("parallel"),
        has_serial_interface:
          interfaceText.includes("serial") || interfaceText.includes("i2s"),
        has_uart: interfaceText.includes("uart"),
        is_differential: /^(yes|true|differential)$/i.test(rawDiff),
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        attributes: attrs,
      }
    })
  },
}
