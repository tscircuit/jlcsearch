import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { BaseComponent } from "./component-base"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

export interface BJTTransistor extends BaseComponent {
  package?: string
  current_gain?: number | null
  collector_current?: number | null
  collector_emitter_voltage?: number | null
  transition_frequency?: number | null
  power_dissipation?: number | null
  temperature_range?: string | null
}

const isMissingAttr = (val: unknown): boolean => {
  if (typeof val !== "string") return true
  const trimmed = val.trim()
  return (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "n/a"
  )
}

const pickAttr = (
  attrs: Record<string, unknown>,
  keys: readonly string[],
): string | undefined => {
  for (const key of keys) {
    const val = attrs[key]
    if (!isMissingAttr(val)) return (val as string).trim()
  }
  return undefined
}

const stripConditionSuffix = (raw: string): string =>
  raw.split("@")[0]?.trim() ?? raw.trim()

const parseGain = (raw: string | undefined): number | null => {
  if (!raw) return null
  const primary = stripConditionSuffix(raw)
  const match = primary.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const parsed = Number.parseFloat(match[1]!)
  return Number.isFinite(parsed) ? parsed : null
}

const parseCurrentAmps = (raw: string | undefined): number | null => {
  if (!raw) return null
  const primary = stripConditionSuffix(raw)
  const match = primary.match(/(-?\d+(?:\.\d+)?)\s*(nA|uA|µA|mA|ma|kA|A)\b/)
  if (!match) return null
  const num = Number.parseFloat(match[1]!)
  if (!Number.isFinite(num)) return null
  const unit = match[2]!
  const factor =
    unit === "nA"
      ? 1e-9
      : unit === "uA" || unit === "µA"
        ? 1e-6
        : unit === "mA" || unit === "ma"
          ? 1e-3
          : unit === "kA"
            ? 1e3
            : 1
  return Number((num * factor).toPrecision(12))
}

const parseVoltageVolts = (raw: string | undefined): number | null => {
  if (!raw) return null
  const primary = stripConditionSuffix(raw).replace(/^±/, "")
  const match = primary.match(/(-?\d+(?:\.\d+)?)\s*(mV|kV|V)\b/)
  if (!match) return null
  const num = Number.parseFloat(match[1]!)
  if (!Number.isFinite(num)) return null
  const unit = match[2]!
  const factor = unit === "mV" ? 1e-3 : unit === "kV" ? 1e3 : 1
  return Number((num * factor).toPrecision(12))
}

const parseFrequencyHz = (raw: string | undefined): number | null => {
  if (!raw) return null
  const primary = stripConditionSuffix(raw)
  const match = primary.match(/(\d+(?:\.\d+)?)\s*(GHz|MHz|kHz|Hz)\b/i)
  if (!match) return null
  const num = Number.parseFloat(match[1]!)
  if (!Number.isFinite(num)) return null
  const unit = match[2]!.toLowerCase()
  const factor =
    unit === "ghz" ? 1e9 : unit === "mhz" ? 1e6 : unit === "khz" ? 1e3 : 1
  return Number((num * factor).toPrecision(12))
}

const parsePowerWatts = (raw: string | undefined): number | null => {
  if (!raw) return null
  const primary = stripConditionSuffix(raw)
  const match = primary.match(/(\d+(?:\.\d+)?)\s*(mW|kW|W)\b/)
  if (!match) return null
  const num = Number.parseFloat(match[1]!)
  if (!Number.isFinite(num)) return null
  const unit = match[2]!
  const factor = unit === "mW" ? 1e-3 : unit === "kW" ? 1e3 : 1
  return Number((num * factor).toPrecision(12))
}

const extractMaxCurrentFromDescription = (
  description: string,
): number | null => {
  let best: number | null = null
  for (const match of description.matchAll(
    /(?<![@\w])(\d+(?:\.\d+)?)\s*(mA|A)\b/g,
  )) {
    const val = parseCurrentAmps(`${match[1]}${match[2]}`)
    if (val !== null && (best === null || val > best)) best = val
  }
  return best
}

const extractMaxVoltageFromDescription = (
  description: string,
): number | null => {
  let best: number | null = null
  for (const match of description.matchAll(
    /(?<![@±\w])(\d+(?:\.\d+)?)\s*(kV|V)\b/g,
  )) {
    const val = parseVoltageVolts(`${match[1]}${match[2]}`)
    if (val !== null && (best === null || val > best)) best = val
  }
  return best
}

export const bjtTransistorTableSpec: DerivedTableSpec<BJTTransistor> = {
  tableName: "bjt_transistor",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "current_gain", type: "real" },
    { name: "collector_current", type: "real" },
    { name: "collector_emitter_voltage", type: "real" },
    { name: "transition_frequency", type: "real" },
    { name: "power_dissipation", type: "real" },
    { name: "temperature_range", type: "text" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "Bipolar Transistors - BJT"),
          eb("categories.subcategory", "=", "Bipolar (BJT)"),
          eb("description", "like", "%BJT%"),
          eb("description", "like", "%Bipolar Transistor%"),
          eb("description", "like", "%Transistor NPN%"),
          eb("description", "like", "%Transistor PNP%"),
        ]),
      )
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const parsedExtra = c.extra ? JSON.parse(c.extra) : null
        const attrs: Record<string, unknown> =
          parsedExtra &&
          typeof parsedExtra === "object" &&
          parsedExtra.attributes
            ? parsedExtra.attributes
            : {}
        const description = String(c.description || "")

        const current_gain = parseGain(
          pickAttr(attrs, [
            "Current Gain (hFE)",
            "DC Current Gain",
            "DC Current Gain (hFE@Ic,Vce)",
          ]),
        )

        const collector_current =
          parseCurrentAmps(
            pickAttr(attrs, [
              "Collector Current (Ic)",
              "Current - Collector(Ic)",
              "Collector Current",
            ]),
          ) ?? extractMaxCurrentFromDescription(description)

        const collector_emitter_voltage =
          parseVoltageVolts(
            pickAttr(attrs, [
              "Collector-Emitter Breakdown Voltage (Vceo)",
              "Collector - Emitter Voltage VCEO",
              "Collector-Emitter Voltage (VCEO)",
            ]),
          ) ?? extractMaxVoltageFromDescription(description)

        const transition_frequency =
          parseFrequencyHz(
            pickAttr(attrs, [
              "Transition Frequency (fT)",
              "Transition frequency(fT)",
            ]),
          ) ??
          parseFrequencyHz(
            description.match(/\b(\d+(?:\.\d+)?\s*(?:GHz|MHz|kHz))\b/i)?.[1],
          )

        const power_dissipation =
          parsePowerWatts(
            pickAttr(attrs, [
              "Power Dissipation (Pd)",
              "Pd - Power Dissipation",
              "Power Dissipation",
            ]),
          ) ??
          parsePowerWatts(
            description.match(/\b(\d+(?:\.\d+)?\s*(?:mW|kW|W))\b/)?.[1],
          )

        const rawTemp =
          pickAttr(attrs, ["Operating Temperature", "Operating temperature"]) ??
          description.match(
            /(-?\d+(?:\.\d+)?\s*(?:℃|°C)\s*~\s*\+?-?\d+(?:\.\d+)?\s*(?:℃|°C))/,
          )?.[1]
        const temperature_range = rawTemp ? stripConditionSuffix(rawTemp) : null

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description,
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
          package: String(c.package || ""),
          current_gain,
          collector_current,
          collector_emitter_voltage,
          transition_frequency,
          power_dissipation,
          temperature_range,
          attributes: attrs as Record<string, string>,
        }
      } catch {
        return null
      }
    })
  },
}
