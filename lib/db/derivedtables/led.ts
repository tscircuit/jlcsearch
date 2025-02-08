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
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((wb) =>
        wb.or([
          wb("categories.subcategory", "=", "Light Emitting Diodes (LED)"),
          wb("categories.subcategory", "=", "Ultra Violet LEDs"),
          wb("categories.subcategory", "=", "Infrared (IR) LEDs"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Led | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse voltage
      const rawVoltage =
        attrs["Forward Voltage"] || attrs["Forward Voltage (VF)"]
      const forwardVoltage = rawVoltage
        ? (parseAndConvertSiUnit(rawVoltage).value as number)
        : null

      // Parse current
      const rawCurrent = attrs["Forward Current"]
      const forwardCurrent = rawCurrent
        ? (parseAndConvertSiUnit(rawCurrent).value as number)
        : null

      // Parse wavelength
      const rawWavelength =
        attrs["Dominant Wavelength"] || attrs["Peak Wavelength"]
      let wavelength = null
      if (rawWavelength) {
        const match = rawWavelength.match(/(\d+)(?:~\d+)?nm/)
        if (match) wavelength = parseInt(match[1])
      }

      // Parse luminous intensity
      const rawIntensity = attrs["Luminous Intensity"]
      const luminousIntensity = rawIntensity
        ? (parseAndConvertSiUnit(rawIntensity).value as number)
        : null

      // Parse viewing angle
      const rawAngle = attrs["Viewing Angle"]
      let viewingAngle = null
      if (rawAngle) {
        const match = rawAngle.match(/(\d+)°/)
        if (match) viewingAngle = parseInt(match[1])
      }

      // Parse power
      const rawPower = attrs["Power Dissipation"]
      const power = rawPower
        ? (parseAndConvertSiUnit(rawPower).value as number)
        : null
      // Parse temperature range
      let tempMin = null
      let tempMax = null
      const rawTemp = attrs["Operating Temperature"]
      if (rawTemp) {
        const match = rawTemp.match(/([-\d]+)℃~\+([-\d]+)℃/)
        if (match) {
          tempMin = parseInt(match[1])
          tempMax = parseInt(match[2])
        }
      }

      // Normalize color
      const normalizeColor = (color: string | null): string | null => {
        if (!color) return null
        // First split and clean the values
        const colors = color
          .toLowerCase()
          .trim()
          .replace(/general/g, "")
          .split(/[\/,\s]+/)
          .filter((s) => s && s !== "-" && s !== ",")
          .map((s) => s.trim())
          .map((s) => s.replace("yellow-green", "greenish_yellow"))

        // Then deduplicate and sort
        return Array.from(new Set(colors)).sort().join("-")
      }

      // Determine color
      let color = normalizeColor(attrs["Emitted Color"])
      if (!color) {
        if (desc.includes("ultraviolet") || desc.includes("uv")) color = "uv"
        else if (desc.includes("infrared") || desc.includes("ir")) color = "ir"
        else {
          const colors = []
          for (const c of [
            "red",
            "green",
            "blue",
            "white",
            "yellow",
            "orange",
            "purple",
          ]) {
            if (desc.includes(c)) {
              colors.push(c)
            }
          }
          color = normalizeColor(colors.join(","))
        }
      }

      // Determine if RGB
      const isRgb = desc.includes("rgb") || desc.includes("full color")

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        price1: extractMinQPrice(c.price)!,
        stock: c.stock,
        in_stock: c.stock > 0,
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
        lens_color: normalizeColor(attrs["Lens Color"]),
        mounting_style: attrs["Mounting Sytle"] || null,
        is_rgb: isRgb,
        attributes: attrs,
      }
    })
  },
}
