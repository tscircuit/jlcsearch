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

const DAC_SUBCATEGORIES = [
  "Digital To Analog Converters (DACs)",
  "Digital To Analog Converters (DAC)",
  "Digital to Analog Converters (DACs)",
  "Digital to Analog Converters (DAC)",
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

const parseSettlingTimeUs = (
  rawAttr: string | null | undefined,
  rawDesc: string,
): number | null => {
  const source = rawAttr ? String(rawAttr) : rawDesc
  const match = source.match(/(\d+(?:\.\d+)?)\s*(ns|us|µs|μs|ms)\b/i)
  if (!match) return null
  const amount = Number.parseFloat(match[1]!)
  if (!Number.isFinite(amount)) return null
  const unit = match[2]!.toLowerCase()
  const scaled =
    unit === "ns" ? amount / 1000 : unit === "ms" ? amount * 1000 : amount
  return Number(scaled.toPrecision(12))
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

const parseNonlinearityLsb = (
  rawAttr: string | null | undefined,
  rawDesc: string,
): number | null => {
  const source = rawAttr ? String(rawAttr) : rawDesc
  const match = source.match(/±?\s*(\d+(?:\.\d+)?)\s*LSB\b/i)
  if (!match) return null
  const value = Number.parseFloat(match[1]!)
  return Number.isFinite(value) ? value : null
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
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or(
          DAC_SUBCATEGORIES.map((subcategory) =>
            eb("categories.subcategory", "=", subcategory),
          ),
        ),
      ),
  mapToTable: (components) => {
    return components.map((c): Dac | null => {
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

      const rawChannels =
        attrs["Number of Channels"] || attrs["number of channels"]
      const parsedChannels = rawChannels
        ? Number.parseInt(String(rawChannels), 10)
        : Number.NaN
      const numChannels =
        Number.isFinite(parsedChannels) && parsedChannels > 0
          ? parsedChannels
          : null

      const settlingTime = parseSettlingTimeUs(attrs["Settling Time"], rawDesc)

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

      const nonlinearity = parseNonlinearityLsb(
        attrs["Integral non - linearity"] ||
          attrs["Integral nonlinearity"] ||
          attrs["Integral Nonlinearity"] ||
          attrs["INL"],
        rawDesc,
      )

      const rawInterface = attrs["Interface"] || attrs["Interface Type"] || ""
      const interfaceType = (rawInterface || rawDesc).toLowerCase()
      const hasI2c =
        interfaceType.includes("i²c") || interfaceType.includes("i2c")
      const hasSpi = interfaceType.includes("spi")
      const hasParallel = interfaceType.includes("parallel")

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
