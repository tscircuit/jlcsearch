import type { DerivedTableSpec } from "./types"
import type { Generated } from "kysely"
import type { Component } from "../generated/kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

type UnwrapGenerated<T> = {
  [K in keyof T]: T[K] extends Generated<infer U> ? U : T[K]
}

export interface Mosfet extends BaseComponent {
  package?: string
  drain_source_voltage?: number | null
  continuous_drain_current?: number | null
  gate_threshold_voltage?: number | null
  power_dissipation?: number | null
  operating_temp_min?: number | null
  operating_temp_max?: number | null
  mounting_style?: string | null
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

const parseOperatingTempRange = (
  rawTemp: string | undefined,
  description: string,
): { min: number | null; max: number | null } => {
  const source = rawTemp ?? description
  const rangeMatch = source.match(
    /(-?\d+(?:\.\d+)?)\s*(?:℃|°C)\s*~\s*\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)/,
  )
  if (rangeMatch) {
    const min = Number.parseFloat(rangeMatch[1]!)
    const max = Number.parseFloat(rangeMatch[2]!)
    return {
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
    }
  }
  if (rawTemp) {
    const singleMatch = stripConditionSuffix(rawTemp).match(
      /\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)/,
    )
    if (singleMatch) {
      const val = Number.parseFloat(singleMatch[1]!)
      if (Number.isFinite(val)) {
        return { min: null, max: val }
      }
    }
  }
  return { min: null, max: null }
}

const inferMountingStyle = (
  explicitMounting: string | undefined,
  pkg: string,
  description: string,
): string | null => {
  if (explicitMounting) return explicitMounting
  const combined = `${pkg} ${description}`
  if (/\b(?:through[- ]?hole|plugin|radial|axial)\b/i.test(combined)) {
    return "Through Hole"
  }
  if (/\b(?:surface[- ]?mount|smd|smt)\b/i.test(combined)) {
    return "Surface Mount"
  }
  const normalizedPkg = pkg.trim().toUpperCase()
  if (!normalizedPkg) return null
  if (
    /^(?:SOT|SOP|SOIC|SSOP|TSSOP|MSOP|QFN|DFN|PDFN|WDFN|UDFN|TDFN|VSON|WSON|LFPAK|DPAK|D2PAK|TO-252|TO-263|TO-277|SC-\d+|SOD)/.test(
      normalizedPkg,
    )
  ) {
    return "Surface Mount"
  }
  if (
    /^(?:TO-92|TO-126|TO-220|TO-247|TO-251|TO-262|TO-264|TO-3P|IPAK|DIP|PDIP|SIP)/.test(
      normalizedPkg,
    )
  ) {
    return "Through Hole"
  }
  return null
}

const extractMaxVoltageFromDescription = (
  description: string,
): number | null => {
  let best: number | null = null
  for (const match of description.matchAll(
    /(?<![@±\w])(\d+(?:\.\d+)?)\s*(kV|V)(?!\s*@)\b/g,
  )) {
    const val = parseVoltageVolts(`${match[1]}${match[2]}`)
    if (val !== null && (best === null || val > best)) best = val
  }
  return best
}

const extractMaxCurrentFromDescription = (
  description: string,
): number | null => {
  let best: number | null = null
  for (const match of description.matchAll(
    /(?<![@\w])(\d+(?:\.\d+)?)\s*(mA|A)(?!\s*@)\b/g,
  )) {
    const val = parseCurrentAmps(`${match[1]}${match[2]}`)
    if (val !== null && (best === null || val > best)) best = val
  }
  return best
}

export const mosfetTableSpec: DerivedTableSpec<Mosfet> = {
  tableName: "mosfet",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "drain_source_voltage", type: "real" },
    { name: "continuous_drain_current", type: "real" },
    { name: "gate_threshold_voltage", type: "real" },
    { name: "power_dissipation", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "mounting_style", type: "text" },
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
          eb("categories.subcategory", "=", "MOSFETs"),
          eb("categories.subcategory", "=", "MOSFET"),
          eb("categories.subcategory", "=", "Single MOSFETs"),
          eb("categories.subcategory", "=", "Dual MOSFETs"),
          eb("categories.subcategory", "=", "MOSFET Arrays"),
          eb("description", "like", "%MOSFET%"),
        ]),
      )
  },
  mapToTable(components: UnwrapGenerated<Component>[]): (Mosfet | null)[] {
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
        const pkg = String(c.package || "")

        const drain_source_voltage =
          parseVoltageVolts(
            pickAttr(attrs, [
              "Drain Source Voltage (Vdss)",
              "Drain to Source Voltage",
              "Drain-Source Voltage (Vdss)",
            ]),
          ) ?? extractMaxVoltageFromDescription(description)

        const continuous_drain_current =
          parseCurrentAmps(
            pickAttr(attrs, [
              "Continuous Drain Current (Id)",
              "Current - Continuous Drain(Id)",
              "Continuous Drain Current",
            ]),
          ) ?? extractMaxCurrentFromDescription(description)

        const gate_threshold_voltage = parseVoltageVolts(
          pickAttr(attrs, [
            "Gate Threshold Voltage (Vgs(th)@Id)",
            "Gate Threshold Voltage (Vgs(th))",
            "Vgs(th) (Max) @ Id",
          ]),
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

        const { min: operating_temp_min, max: operating_temp_max } =
          parseOperatingTempTemp(attrs, description)

        const mounting_style = inferMountingStyle(
          pickAttr(attrs, ["Mounting Style", "Mounting Type"]),
          pkg,
          description,
        )

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description,
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
          package: pkg,
          drain_source_voltage,
          continuous_drain_current,
          gate_threshold_voltage,
          power_dissipation,
          operating_temp_min,
          operating_temp_max,
          mounting_style,
          attributes: attrs as Record<string, string>,
        }
      } catch {
        return null
      }
    })
  },
}

const parseOperatingTempTemp = (
  attrs: Record<string, unknown>,
  description: string,
) =>
  parseOperatingTempRange(
    pickAttr(attrs, ["Operating Temperature", "Operating temperature"]),
    description,
  )
