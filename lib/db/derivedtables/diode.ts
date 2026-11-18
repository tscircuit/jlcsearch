import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface Diode extends BaseComponent {
  // Extra columns
  package: string
  forward_voltage: number | null
  reverse_voltage: number | null
  forward_current: number | null
  reverse_leakage_current: number | null
  recovery_time_ns: number | null
  diode_type: string
  is_schottky: boolean
  is_zener: boolean
  is_tvs: boolean
  operating_temp_min: number | null
  operating_temp_max: number | null
  power_dissipation_watts: number | null
  configuration: string | null
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
  if (!raw) return null
  const cleaned = raw.split("@")[0]?.trim()
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

const POWER_TO_WATTS: Record<string, number> = {
  µW: 1e-6,
  mW: 1e-3,
  W: 1,
  kW: 1e3,
}

const TIME_TO_NS: Record<string, number> = {
  ps: 1e-3,
  ns: 1,
  µs: 1e3,
  ms: 1e6,
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

export const diodeTableSpec: DerivedTableSpec<Diode> = {
  tableName: "diode",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "forward_voltage", type: "real" },
    { name: "reverse_voltage", type: "real" },
    { name: "forward_current", type: "real" },
    { name: "reverse_leakage_current", type: "real" },
    { name: "recovery_time_ns", type: "real" },
    { name: "diode_type", type: "text" },
    { name: "is_schottky", type: "boolean" },
    { name: "is_zener", type: "boolean" },
    { name: "is_tvs", type: "boolean" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "power_dissipation_watts", type: "real" },
    { name: "configuration", type: "text" },
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
          eb("categories.subcategory", "=", "Diodes - General Purpose"),
          eb("categories.subcategory", "=", "Schottky Barrier Diodes (SBD)"),
          eb("categories.subcategory", "=", "Schottky Diodes"),
          eb("categories.subcategory", "=", "Zener Diodes"),
          eb("categories.subcategory", "=", "TVS"),
          eb("categories.subcategory", "=", "Switching Diode"),
          eb("categories.subcategory", "=", "Switching Diodes"),
          eb(
            "categories.subcategory",
            "=",
            "Fast Recovery / High Efficiency Diodes",
          ),
          eb(
            "categories.subcategory",
            "=",
            "Fast Recovery/High Efficiency Diode",
          ),
          eb(
            "categories.subcategory",
            "=",
            "Diodes - Fast Recovery Rectifiers",
          ),
          eb(
            "categories.subcategory",
            "=",
            "Diodes - Rectifiers - Fast Recovery",
          ),
          eb("categories.subcategory", "=", "Diodes Rectifiers Fast Recovery"),
          eb("categories.subcategory", "=", "Diodes - Rectifiers - Hyperfast"),
          eb("categories.subcategory", "=", "High Effic Rectifier"),
          eb("categories.subcategory", "=", "Super Barrier Rectifiers (SBR)"),
          eb("categories.subcategory", "=", "Super Barrier Rectifier（SBR）"),
          eb("categories.subcategory", "=", "Bridge Rectifiers"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Diode | null => {
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
      const attrType = String(
        firstAttribute(attrs, ["Type"]) || "",
      ).toLowerCase()
      const classificationText = `${desc} ${subcat} ${attrType}`

      // Parse forward voltage (JLCPCB uses "Voltage - Forward(Vf@If)", often in mV)
      const rawForwardV =
        firstAttribute(attrs, [
          "Voltage - Forward(Vf@If)",
          "Voltage - Forward (Vf@If)",
          "Forward Voltage (Vf@If)",
          "Forward Voltage (Vf)",
        ]) ??
        rawDesc.match(
          /\b(\d+(?:\.\d+)?\s*m?V)@\d+(?:\.\d+)?\s*[umµ]?A\b/i,
        )?.[1] ??
        null
      const forwardVoltage = parseScaledNumber(rawForwardV, VOLTAGE_TO_VOLTS)

      // Parse reverse voltage (JLCPCB uses "Voltage - DC Reverse(Vr)")
      const reverseVoltage = parseScaledNumber(
        firstAttribute(attrs, [
          "Voltage - DC Reverse(Vr)",
          "Voltage - DC Reverse (Vr) (Max)",
          "Reverse Voltage (Vr)",
          "Reverse Stand-Off Voltage (Vrwm)",
        ]),
        VOLTAGE_TO_VOLTS,
      )

      // Parse forward current (JLCPCB uses "Current - Rectified" / "Rectified Current")
      const forwardCurrent = parseScaledNumber(
        firstAttribute(attrs, [
          "Current - Rectified",
          "Rectified Current",
          "Average Rectified Current (Io)",
        ]),
        CURRENT_TO_AMPS,
      )

      // Parse reverse leakage current
      const leakageCurrent = safeParseSiUnit(
        firstAttribute(attrs, [
          "Reverse Leakage Current (Ir)",
          "Reverse Leakage Current",
        ]),
      )

      // Parse recovery time in nanoseconds
      const rawRecovery =
        firstAttribute(attrs, ["Reverse Recovery Time (trr)"]) ??
        rawDesc.match(/\b(\d+(?:\.\d+)?\s*[nuµμ]s)\b/i)?.[1] ??
        null
      const recoveryTime = parseScaledNumber(rawRecovery, TIME_TO_NS)

      // Parse temperature range (JLCPCB uses "Operating Junction Temperature Range")
      const tempText =
        firstAttribute(attrs, [
          "Operating Junction Temperature Range",
          "Operating Temperature",
          "Operating Temperature Range",
        ]) ??
        rawDesc.match(
          /-?\d+(?:\.\d+)?\s*(?:℃|°C)\s*~\s*\+?-?\d+(?:\.\d+)?\s*(?:℃|°C)/i,
        )?.[0] ??
        null
      const { min: tempMin, max: tempMax } = parseTemperatureRange(tempText)

      // Parse power dissipation in watts (JLCPCB uses "Pd - Power Dissipation")
      const powerDissipation = parseScaledNumber(
        firstAttribute(attrs, [
          "Pd - Power Dissipation",
          "Power Dissipation",
          "Peak Pulse Power Dissipation (Ppp)",
        ]),
        POWER_TO_WATTS,
      )

      // Determine diode type and characteristics
      const isSchottky =
        classificationText.includes("schottky") ||
        classificationText.includes("super barrier")
      const isZener =
        classificationText.includes("zener") ||
        Boolean(
          firstAttribute(attrs, ["Zener Voltage(Nom)", "Zener Voltage (Nom)"]),
        )
      const isTvs =
        classificationText.includes("tvs") ||
        classificationText.includes("transient voltage suppressor")

      let diodeType = "general_purpose"
      if (isSchottky) diodeType = "schottky_barrier"
      else if (isZener) diodeType = "zener"
      else if (isTvs) diodeType = "tvs"
      else if (classificationText.includes("switching")) diodeType = "switching"
      else if (
        classificationText.includes("fast recovery") ||
        classificationText.includes("high effic") ||
        classificationText.includes("hyperfast")
      ) {
        diodeType = "fast_recovery"
      } else if (classificationText.includes("bridge")) {
        diodeType = "bridge_rectifier"
      }

      const configuration = firstAttribute(attrs, ["Diode Configuration"])

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
        forward_voltage: forwardVoltage,
        reverse_voltage: reverseVoltage,
        forward_current: forwardCurrent,
        reverse_leakage_current: leakageCurrent,
        recovery_time_ns: recoveryTime,
        diode_type: diodeType,
        is_schottky: isSchottky,
        is_zener: isZener,
        is_tvs: isTvs,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        power_dissipation_watts: powerDissipation,
        configuration: configuration,
        attributes: attrs,
      }
    })
  },
}
