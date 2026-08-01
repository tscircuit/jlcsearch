import { BaseComponent } from "lib/db/derivedtables/component-base"
import type { DerivedTableSpec } from "lib/db/derivedtables/types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

export interface PhotoDiode extends BaseComponent {
  package: string
  peak_wavelength_nm: number | null
  spectral_range_min_nm: number | null
  spectral_range_max_nm: number | null
  reverse_voltage: number | null
  dark_current_a: number | null
  reception_angle_deg: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
}

const SI_MULTIPLIERS: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  m: 1e-3,
  "": 1,
  k: 1e3,
  M: 1e6,
}

const parseSiValue = (
  value: string | undefined,
  unit: "A" | "V",
): number | null => {
  if (!value || value.trim() === "-") return null
  const match = value.match(
    new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*([pnuµμmkM]?)${unit}\\b`),
  )
  if (!match) return null

  const parsed = Number.parseFloat(match[1]) * SI_MULTIPLIERS[match[2]]
  return Number.isFinite(parsed) ? parsed : null
}

const parseWavelength = (value: string | undefined): number | null => {
  if (!value || value.trim() === "-") return null
  const match = value.match(/(\d+(?:\.\d+)?)\s*nm\b/i)
  if (!match) return null

  const parsed = Number.parseFloat(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

const parseSpectralRange = (
  value: string | undefined,
): [number | null, number | null] => {
  if (!value || value.trim() === "-") return [null, null]
  const match = value.match(
    /(\d+(?:\.\d+)?)\s*nm\s*(?:~|～|to)\s*(\d+(?:\.\d+)?)\s*nm/i,
  )
  if (!match) return [null, null]

  const min = Number.parseFloat(match[1])
  const max = Number.parseFloat(match[2])
  return [Number.isFinite(min) ? min : null, Number.isFinite(max) ? max : null]
}

const parseAngle = (value: string | undefined): number | null => {
  if (!value || value.trim() === "-") return null
  const match = value.match(/(?:±\s*)?(\d+(?:\.\d+)?)\s*°/)
  if (!match) return null

  const parsed = Number.parseFloat(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

const parseTemperatureRange = (
  value: string | undefined,
): [number | null, number | null] => {
  if (!value || value.trim() === "-") return [null, null]
  const match = value.match(
    /(-?\d+(?:\.\d+)?)\s*(?:℃|°C)\s*(?:~|～|to)\s*\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)/i,
  )
  if (!match) return [null, null]

  const min = Number.parseFloat(match[1])
  const max = Number.parseFloat(match[2])
  return [Number.isFinite(min) ? min : null, Number.isFinite(max) ? max : null]
}

export const photoDiodeTableSpec: DerivedTableSpec<PhotoDiode> = {
  tableName: "photo_diode",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "peak_wavelength_nm", type: "real" },
    { name: "spectral_range_min_nm", type: "real" },
    { name: "spectral_range_max_nm", type: "real" },
    { name: "reverse_voltage", type: "real" },
    { name: "dark_current_a", type: "real" },
    { name: "reception_angle_deg", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  indexes: [
    { name: "idx_photo_diode_stock", columns: ["stock"] },
    {
      name: "idx_photo_diode_package_stock",
      columns: ["package", "stock"],
    },
    {
      name: "idx_photo_diode_peak_wavelength_stock",
      columns: ["peak_wavelength_nm", "stock"],
    },
    {
      name: "idx_photo_diode_reverse_voltage_stock",
      columns: ["reverse_voltage", "stock"],
    },
    {
      name: "idx_photo_diode_dark_current_stock",
      columns: ["dark_current_a", "stock"],
    },
    {
      name: "idx_photo_diode_is_basic_stock",
      columns: ["is_basic", "stock"],
    },
    {
      name: "idx_photo_diode_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "=", "Photodiodes"),
  mapToTable: (components) =>
    components.map((component) => {
      try {
        const extra = component.extra ? JSON.parse(component.extra) : {}
        const attrs: Record<string, string> = extra.attributes || {}
        const description = String(component.description || "")
        const spectralRange =
          attrs["Spectral Range"] ??
          description.match(
            /\d+(?:\.\d+)?\s*nm\s*(?:~|～|to)\s*\d+(?:\.\d+)?\s*nm/i,
          )?.[0]
        const [spectralRangeMin, spectralRangeMax] =
          parseSpectralRange(spectralRange)
        const operatingTemperature =
          attrs["Operating Temperature"] ??
          description.match(
            /-?\d+(?:\.\d+)?\s*(?:℃|°C)\s*(?:~|～|to)\s*\+?-?\d+(?:\.\d+)?\s*(?:℃|°C)/i,
          )?.[0]
        const [operatingTempMin, operatingTempMax] =
          parseTemperatureRange(operatingTemperature)
        const peakWavelengthSource =
          attrs["Peak Wavelength"] ??
          attrs["Peak  Wavelength"] ??
          description.replace(spectralRange ?? "", "")

        return {
          lcsc: Number(component.lcsc),
          mfr: String(component.mfr || ""),
          description,
          stock: Number(component.stock || 0),
          price1: extractMinQPrice(component.price),
          in_stock: Boolean((component.stock || 0) > 0),
          is_basic: Boolean(component.basic),
          is_preferred: Boolean(component.preferred),
          package: String(component.package || ""),
          peak_wavelength_nm: parseWavelength(peakWavelengthSource),
          spectral_range_min_nm: spectralRangeMin,
          spectral_range_max_nm: spectralRangeMax,
          reverse_voltage: parseSiValue(
            attrs["DC Reverse Voltage"] ??
              attrs["Reverse Voltage"] ??
              description,
            "V",
          ),
          dark_current_a: parseSiValue(
            attrs["Dark Current"] ?? attrs["Current Dark"] ?? description,
            "A",
          ),
          reception_angle_deg: parseAngle(
            attrs["Reception Angle"] ?? attrs["Viewing Angle"],
          ),
          operating_temp_min: operatingTempMin,
          operating_temp_max: operatingTempMax,
          attributes: attrs,
        }
      } catch {
        return null
      }
    }),
}
