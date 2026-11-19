import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface VoltageRegulator extends BaseComponent {
  package: string
  output_type: "fixed" | "adjustable" | "unknown"
  output_voltage_min: number | null
  output_voltage_max: number | null
  output_current_max: number | null
  dropout_voltage: number | null
  input_voltage_min: number | null
  input_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  quiescent_current: number | null
  power_supply_rejection_db: number | null
  output_noise_uvrms: number | null
  is_low_dropout: boolean
  is_positive: boolean
  topology: string | null
}

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

const firstAttribute = (
  attrs: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const raw = attrs[key]
    if (typeof raw !== "string") continue
    const trimmed = raw.trim()
    if (trimmed && trimmed !== "-" && trimmed.toLowerCase() !== "null") {
      return trimmed
    }
  }
  return null
}

const safeParseSiUnit = (raw: string | null | undefined): number | null => {
  if (!raw) return null
  const head = raw.split("@")[0]?.trim()
  if (!head || head === "-") return null
  try {
    const parsed = parseAndConvertSiUnit(head).value
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

const parseScaledNumber = (
  raw: string | null | undefined,
  unitMultipliers: Record<string, number>,
): number | null => {
  if (!raw || raw.includes("%")) return null
  const cleaned = raw.split("@")[0]?.replace(/rms/gi, "").trim()
  if (!cleaned || cleaned === "-") return null
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Zµμ]+)$/)
  if (match) {
    const value = Number.parseFloat(match[1]!)
    const unit = match[2]!.replace("μ", "µ").replace("u", "µ")
    const factor = unitMultipliers[unit]
    if (Number.isFinite(value) && factor !== undefined) {
      return Number((value * factor).toPrecision(10))
    }
  }
  return safeParseSiUnit(cleaned)
}

const VOLTAGE_TO_VOLTS: Record<string, number> = {
  nV: 1e-9,
  µV: 1e-6,
  mV: 1e-3,
  V: 1,
  kV: 1e3,
}

const CURRENT_TO_AMPS: Record<string, number> = {
  pA: 1e-12,
  nA: 1e-9,
  µA: 1e-6,
  mA: 1e-3,
  A: 1,
  kA: 1e3,
}

const NOISE_TO_UVRMS: Record<string, number> = {
  nV: 1e-3,
  µV: 1,
  mV: 1e3,
  V: 1e6,
}

const parseVoltageRange = (
  raw: string | null,
): { min: number | null; max: number | null } => {
  if (!raw) return { min: null, max: null }
  const rangeMatch = raw.match(
    /(-?\d+(?:\.\d+)?\s*[nuµμmk]?V)\s*(?:~|to)\s*(-?\d+(?:\.\d+)?\s*[nuµμmk]?V)/i,
  )
  if (rangeMatch) {
    const a = parseScaledNumber(rangeMatch[1], VOLTAGE_TO_VOLTS)
    const b = parseScaledNumber(rangeMatch[2], VOLTAGE_TO_VOLTS)
    if (a !== null && b !== null) {
      return { min: Math.min(a, b), max: Math.max(a, b) }
    }
  }
  const single = parseScaledNumber(raw, VOLTAGE_TO_VOLTS)
  return { min: single, max: single }
}

const parseTemperatureRange = (
  raw: string | null,
): { min: number | null; max: number | null } => {
  if (!raw) return { min: null, max: null }
  const match = raw.match(
    /(-?\d+(?:\.\d+)?)\s*(?:℃|°C)?\s*(?:~|to)\s*\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)?/i,
  )
  if (!match) return { min: null, max: null }
  const min = Number.parseFloat(match[1]!)
  const max = Number.parseFloat(match[2]!)
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: null, max: null }
  }
  return { min, max }
}

export const voltageRegulatorTableSpec: DerivedTableSpec<VoltageRegulator> = {
  tableName: "voltage_regulator",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "output_type", type: "text" },
    { name: "output_voltage_min", type: "real" },
    { name: "output_voltage_max", type: "real" },
    { name: "output_current_max", type: "real" },
    { name: "dropout_voltage", type: "real" },
    { name: "input_voltage_min", type: "real" },
    { name: "input_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "quiescent_current", type: "real" },
    { name: "power_supply_rejection_db", type: "real" },
    { name: "output_noise_uvrms", type: "real" },
    { name: "is_low_dropout", type: "boolean" },
    { name: "is_positive", type: "boolean" },
    { name: "topology", type: "text" },
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
          eb("categories.subcategory", "=", "Linear Voltage Regulators"),
          eb("categories.subcategory", "=", "Linear Voltage Regulators (LDO)"),
          eb("categories.subcategory", "=", "Low Dropout Regulators(LDO)"),
          eb("categories.subcategory", "=", "Dropout Regulators(LDO)"),
          eb(
            "categories.subcategory",
            "=",
            "Voltage Regulators - Linear, Low Drop Out (LDO) Regulators",
          ),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): VoltageRegulator | null => {
      const extra = parseExtraJson(c.extra)
      const attrs =
        extra.attributes && typeof extra.attributes === "object"
          ? extra.attributes
          : {}
      const rawDesc = c.description ?? ""
      const desc = rawDesc.toLowerCase()
      const subcat = String(
        (c as { subcategory?: string }).subcategory ||
          extra.category?.name2 ||
          "",
      ).toLowerCase()

      // Parse output type
      const rawOutputType = (
        firstAttribute(attrs, ["Output Type"]) || ""
      ).toLowerCase()
      let outputType: "fixed" | "adjustable" | "unknown" = "unknown"
      if (rawOutputType.includes("fixed")) {
        outputType = "fixed"
      } else if (rawOutputType.includes("adjustable")) {
        outputType = "adjustable"
      } else if (/\bfixed\b/.test(desc)) {
        outputType = "fixed"
      } else if (/\badjustable\b/.test(desc)) {
        outputType = "adjustable"
      }

      // Parse output voltage range
      const { min: voltageMin, max: voltageMax } = parseVoltageRange(
        firstAttribute(attrs, ["Output Voltage"]),
      )

      // Parse output current
      const outputCurrent = parseScaledNumber(
        firstAttribute(attrs, ["Output Current"]),
        CURRENT_TO_AMPS,
      )

      // Parse dropout voltage (JLCPCB uses "Voltage Dropout", including mV@(current) values)
      const rawDropout =
        firstAttribute(attrs, ["Voltage Dropout", "Dropout Voltage"]) ??
        rawDesc.match(/\b(\d+(?:\.\d+)?\s*[nuµμm]?V)@\([^)]+\)/i)?.[1] ??
        null
      const dropoutVoltage = parseScaledNumber(rawDropout, VOLTAGE_TO_VOLTS)

      // Parse input voltage range (JLCPCB uses "Voltage - Supply" for max or range)
      const rawInputVoltage = firstAttribute(attrs, [
        "Maximum Input Voltage",
        "Voltage - Supply",
        "Input Voltage",
        "Operating Voltage",
      ])
      let inputVoltageMin: number | null = null
      let inputVoltageMax: number | null = null
      if (rawInputVoltage) {
        if (/(?:~|to)/i.test(rawInputVoltage)) {
          const parsedRange = parseVoltageRange(rawInputVoltage)
          inputVoltageMin = parsedRange.min
          inputVoltageMax = parsedRange.max
        } else {
          inputVoltageMax = parseScaledNumber(rawInputVoltage, VOLTAGE_TO_VOLTS)
          if (
            inputVoltageMax !== null &&
            dropoutVoltage !== null &&
            voltageMin !== null &&
            voltageMin >= 0 &&
            inputVoltageMax > 0
          ) {
            inputVoltageMin = Number(
              (voltageMin + dropoutVoltage).toPrecision(10),
            )
          }
        }
      }

      // Parse temperature range
      const tempText =
        firstAttribute(attrs, [
          "Operating Temperature",
          "Operating Temperature Range",
        ]) ??
        rawDesc.match(
          /-?\d+(?:\.\d+)?\s*(?:℃|°C)\s*~\s*\+?-?\d+(?:\.\d+)?\s*(?:℃|°C)/i,
        )?.[0] ??
        null
      const { min: tempMin, max: tempMax } = parseTemperatureRange(tempText)

      // Parse quiescent current (JLCPCB uses "standby current" / "Supply Current (Iq)")
      const quiescentCurrent = parseScaledNumber(
        firstAttribute(attrs, [
          "Quiescent Current (Ground Current)",
          "Quiescent Current (Iq)",
          "Supply Current (Iq)",
          "standby current",
          "Quiescent Current",
        ]),
        CURRENT_TO_AMPS,
      )

      // Parse power supply rejection ratio
      const rawPsrr =
        firstAttribute(attrs, ["Power Supply Rejection Ratio (PSRR)"]) ??
        rawDesc.match(/\b(\d+(?:\.\d+)?)\s*dB/i)?.[0] ??
        null
      const psrrMatch = rawPsrr?.match(/([\d.]+)\s*dB/i)
      const psrr = psrrMatch ? Number.parseFloat(psrrMatch[1]!) : null

      // Parse output noise (ignore percentage specs like "0.003%Vout")
      const rawNoise =
        firstAttribute(attrs, ["Output Noise", "Noise"]) ??
        rawDesc.match(/\b(\d+(?:\.\d+)?\s*[nuµμm]?Vrms)\b/i)?.[1] ??
        null
      const outputNoise = parseScaledNumber(rawNoise, NOISE_TO_UVRMS)

      // Determine regulator characteristics
      const isLdo = Boolean(
        desc.includes("ldo") ||
          desc.includes("low drop") ||
          desc.includes("low-drop") ||
          subcat.includes("ldo") ||
          subcat.includes("low drop") ||
          subcat.includes("dropout") ||
          (dropoutVoltage !== null && dropoutVoltage < 0.7),
      )

      const polarity = (
        firstAttribute(attrs, ["Output Configuration", "Output Polarity"]) || ""
      ).toLowerCase()
      const isPositive = polarity.includes("negative")
        ? false
        : polarity.includes("positive")
          ? true
          : !desc.includes("negative") &&
            !(voltageMax !== null && voltageMax < 0)

      const topology = firstAttribute(attrs, ["Topology"])

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
        output_type: outputType,
        output_voltage_min: voltageMin,
        output_voltage_max: voltageMax,
        output_current_max: outputCurrent,
        dropout_voltage: dropoutVoltage,
        input_voltage_min: inputVoltageMin,
        input_voltage_max: inputVoltageMax,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        quiescent_current: quiescentCurrent,
        power_supply_rejection_db: psrr,
        output_noise_uvrms: outputNoise,
        is_low_dropout: isLdo,
        is_positive: isPositive,
        topology: topology,
        attributes: attrs,
      }
    })
  },
}
