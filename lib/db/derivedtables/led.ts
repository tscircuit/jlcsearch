import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Led extends BaseComponent {
  package: string
  forward_voltage: number | null
  forward_current: number | null
  color: string | null
  wavelength_nm: number | null
  luminous_intensity_mcd: number | null
  viewing_angle_deg: number | null
  power_dissipation_mw: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  lens_color: string | null
  mounting_style: string | null
  is_rgb: boolean
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

const safeParseSiUnit = (raw: string | null | undefined): number | null => {
  if (!raw) return null
  const firstPart = raw.split("~")[0]?.trim()
  if (!firstPart || firstPart === "-") return null
  try {
    const parsed = parseAndConvertSiUnit(firstPart).value
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null
  } catch {
    const match = firstPart.match(/-?\d+(?:\.\d+)?/)
    return match ? Number.parseFloat(match[0]) : null
  }
}

const parseVoltageFromText = (
  raw: string | null | undefined,
): number | null => {
  if (!raw) return null
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(m?V)\b/)
  if (!match) return null
  const value = Number.parseFloat(match[1]!)
  if (!Number.isFinite(value)) return null
  return match[2] === "mV" ? value / 1000 : value
}

const parseCurrentFromText = (
  raw: string | null | undefined,
): number | null => {
  if (!raw) return null
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(uA|µA|mA|A)\b/)
  if (!match) return null
  return safeParseSiUnit(`${match[1]}${match[2]}`)
}

const parsePowerMwFromText = (
  raw: string | null | undefined,
): number | null => {
  if (!raw) return null
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(mW|W)\b/)
  if (!match) return null
  const value = Number.parseFloat(match[1]!)
  if (!Number.isFinite(value)) return null
  return match[2] === "W" ? value * 1000 : value
}

const normalizeColor = (
  color: string | null | undefined,
  { stripEmittedModifiers = false } = {},
): string | null => {
  if (!color) return null
  const ignoredTokens = stripEmittedModifiers
    ? new Set(["-", ",", "light", "emerald"])
    : new Set(["-", ","])
  const colors = color
    .toLowerCase()
    .trim()
    .replace(/general/g, "")
    .split(/[\/,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s && !ignoredTokens.has(s))
    .map((s) => s.replace("yellow-green", "greenish_yellow"))

  if (colors.length === 0) return null
  return Array.from(new Set(colors)).sort().join("-")
}

export const ledTableSpec: DerivedTableSpec<Led> = {
  tableName: "led",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "forward_voltage", type: "real" },
    { name: "forward_current", type: "real" },
    { name: "color", type: "text" },
    { name: "wavelength_nm", type: "real" },
    { name: "luminous_intensity_mcd", type: "real" },
    { name: "viewing_angle_deg", type: "real" },
    { name: "power_dissipation_mw", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "lens_color", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "is_rgb", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((wb) =>
        wb.or([
          wb("categories.subcategory", "=", "Light Emitting Diodes (LED)"),
          wb("categories.subcategory", "=", "LED Indication - Discrete"),
          wb("categories.subcategory", "=", "Ultra Violet LEDs"),
          wb("categories.subcategory", "=", "Infrared (IR) LEDs"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Led | null => {
      const extra = parseExtraJson(c.extra)
      const attrs =
        extra.attributes && typeof extra.attributes === "object"
          ? extra.attributes
          : {}
      const rawDesc = c.description ?? ""
      const desc = rawDesc.toLowerCase()

      // Parse voltage
      const rawVoltage =
        attrs["Forward Voltage"] ||
        attrs["Forward Voltage (VF)"] ||
        attrs["Voltage - Forward(Vf)"]
      const forwardVoltage =
        safeParseSiUnit(rawVoltage) ?? parseVoltageFromText(rawDesc)

      // Parse current
      const rawCurrent = attrs["Forward Current"] || attrs["Test Current"]
      const forwardCurrent =
        safeParseSiUnit(rawCurrent) ?? parseCurrentFromText(rawDesc)

      // Parse wavelength
      const rawWavelength =
        attrs["Dominant Wavelength"] ||
        attrs["Wavelength - Dominant"] ||
        attrs["Peak Wavelength"] ||
        rawDesc
      let wavelength: number | null = null
      if (rawWavelength) {
        const match = String(rawWavelength).match(/(\d+)(?:~\d+)?nm/)
        if (match) wavelength = parseInt(match[1]!)
      }

      // Parse luminous intensity
      const rawIntensity = attrs["Luminous Intensity"]
      const intensityMatch = !rawIntensity
        ? rawDesc.match(/\b(\d+(?:\.\d+)?)\s*mcd\b/i)
        : null
      const luminousIntensity =
        safeParseSiUnit(rawIntensity) ??
        (intensityMatch ? Number.parseFloat(intensityMatch[1]!) : null)

      // Parse viewing angle
      const rawAngle = attrs["Viewing Angle"] || rawDesc
      let viewingAngle: number | null = null
      if (rawAngle) {
        const match = String(rawAngle).match(/(\d+)°/)
        if (match) viewingAngle = parseInt(match[1]!)
      }

      // Parse power
      const rawPower = attrs["Power Dissipation"] || attrs["Power(Watts)"]
      const power =
        (rawPower ? parsePowerMwFromText(String(rawPower)) : null) ??
        safeParseSiUnit(rawPower) ??
        parsePowerMwFromText(rawDesc)

      // Parse temperature range
      let tempMin: number | null = null
      let tempMax: number | null = null
      const rawTemp = attrs["Operating Temperature"] || rawDesc
      if (rawTemp) {
        const match = String(rawTemp).match(/([-\d]+)℃~\+?([-\d]+)℃/)
        if (match) {
          tempMin = parseInt(match[1]!)
          tempMax = parseInt(match[2]!)
        }
      }

      // Determine emitted color (strip lens descriptors so e.g. "Yellow Lens" doesn't pollute color)
      let color = normalizeColor(
        attrs["Emitted Color"] || attrs["Illumination Color"],
        { stripEmittedModifiers: true },
      )
      if (!color) {
        if (desc.includes("ultraviolet") || desc.includes("uv")) color = "uv"
        else if (desc.includes("infrared") || desc.includes("ir")) color = "ir"
        else {
          const descWithoutLens = desc.replace(/\b[a-z-]+\s+lens\b/g, " ")
          const colors = []
          for (const candidateColor of [
            "red",
            "green",
            "blue",
            "white",
            "yellow",
            "orange",
            "purple",
          ]) {
            if (descWithoutLens.includes(candidateColor)) {
              colors.push(candidateColor)
            }
          }
          color = normalizeColor(colors.join(","))
        }
      }

      // Determine lens color
      let lensColor = normalizeColor(attrs["Lens Color"])
      if (!lensColor) {
        if (desc.includes("water clear")) {
          lensColor = "clear-water"
        } else {
          const lensMatch = desc.match(/\b([a-z-]+)\s+lens\b/)
          if (lensMatch) {
            lensColor = normalizeColor(lensMatch[1])
          }
        }
      }

      // Determine if RGB
      const isRgb = desc.includes("rgb") || desc.includes("full color")

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: rawDesc,
        price1: c.price ? extractMinQPrice(c.price)! : (null as any),
        stock: c.stock,
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_extended_promotional: Boolean(c.preferred) && !Boolean(c.basic),

        is_preferred: Boolean(c.preferred),
        package: c.package || "",
        forward_voltage: forwardVoltage,
        forward_current: forwardCurrent,
        color: color,
        wavelength_nm: wavelength,
        luminous_intensity_mcd: luminousIntensity,
        viewing_angle_deg: viewingAngle,
        power_dissipation_mw: power,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        lens_color: lensColor,
        mounting_style:
          attrs["Mounting Style"] || attrs["Mounting Sytle"] || null,
        is_rgb: isRgb,
        attributes: attrs,
      }
    })
  },
}
