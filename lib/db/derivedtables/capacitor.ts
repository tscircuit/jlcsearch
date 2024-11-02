import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"

interface Capacitor {
  lcsc: number
  mfr: string
  description: string
  stock: number
  in_stock: boolean
  attributes: Record<string, string>

  // Extra columns
  capacitance_farads: number
  tolerance_fraction: number
  voltage_rating: number
  package: string
  temperature_coefficient: string | null
  lifetime_hours: number | null
  esr_ohms: number | null
  ripple_current_amps: number | null
  is_polarized: boolean
  is_surface_mount: boolean
  capacitor_type: string
}

export const capacitorTableSpec: DerivedTableSpec<Capacitor> = {
  tableName: "capacitor",
  extraColumns: [
    { name: "capacitance_farads", type: "real" },
    { name: "tolerance_fraction", type: "real" },
    { name: "voltage_rating", type: "real" },
    { name: "package", type: "text" },
    { name: "temperature_coefficient", type: "text" },
    { name: "lifetime_hours", type: "real" },
    { name: "esr_ohms", type: "real" },
    { name: "ripple_current_amps", type: "real" },
    { name: "is_polarized", type: "boolean" },
    { name: "is_surface_mount", type: "boolean" },
    { name: "capacitor_type", type: "text" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.category", "=", "Capacitors"),
  mapToTable: (components) => {
    return components.map((c): Capacitor | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const rawCapacitance = extra?.attributes?.["Capacitance"]
      const rawTolerance = extra?.attributes?.["Tolerance"]
      const rawVoltage = extra?.attributes?.["Rated Voltage"] || 
                        extra?.attributes?.["Voltage Rated"] ||
                        extra?.attributes?.["Voltage(AC)"]
      
      // Parse main specifications
      const capacitance = parseAndConvertSiUnit(rawCapacitance).value as number
      const tolerance = parseAndConvertSiUnit(rawTolerance).value as number
      const voltage = parseAndConvertSiUnit(rawVoltage).value as number

      // Parse additional specifications
      const tempCoef = extra?.attributes?.["Temperature Coefficient"]
      const lifetime = parseInt(extra?.attributes?.["Lifetime @ Temp"]?.split("hrs")?.[0]) || null
      
      // Parse ESR and ripple current if available
      let esr = null
      const rawEsr = extra?.attributes?.["Equivalent Series Resistance(ESR)"] ||
                    extra?.attributes?.["ESR"]
      if (rawEsr) {
        const match = rawEsr.match(/(\d+(?:\.\d+)?)(m?)Ω/)
        if (match) {
          esr = parseFloat(match[1]) * (match[2] === 'm' ? 0.001 : 1)
        }
      }

      let rippleCurrent = null
      const rawRipple = extra?.attributes?.["Ripple Current"]
      if (rawRipple) {
        const parsed = parseAndConvertSiUnit(rawRipple.split("@")[0]).value
        if (parsed) rippleCurrent = parsed
      }

      // Determine capacitor characteristics
      const desc = c.description.toLowerCase()
      const isPolarized = desc.includes("electrolytic") || 
                         desc.includes("tantalum") ||
                         desc.includes("polymer")
      
      const isSurfaceMount = c.package?.toLowerCase().includes("smd") || 
                            !c.package?.toLowerCase().includes("plugin")

      // Determine capacitor type
      let capacitorType = "unknown"
      if (desc.includes("ceramic")) capacitorType = "ceramic"
      else if (desc.includes("electrolytic")) capacitorType = "electrolytic"
      else if (desc.includes("tantalum")) capacitorType = "tantalum"
      else if (desc.includes("film")) capacitorType = "film"
      else if (desc.includes("polymer")) capacitorType = "polymer"
      else if (desc.includes("mica")) capacitorType = "mica"
      else if (desc.includes("variable") || desc.includes("trimmer")) capacitorType = "variable"

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        in_stock: c.in_stock,
        capacitance_farads: capacitance,
        tolerance_fraction: tolerance,
        voltage_rating: voltage,
        package: c.package || "",
        temperature_coefficient: tempCoef,
        lifetime_hours: lifetime,
        esr_ohms: esr,
        ripple_current_amps: rippleCurrent,
        is_polarized: isPolarized,
        is_surface_mount: isSurfaceMount,
        capacitor_type: capacitorType,
        attributes: extra.attributes,
      }
    })
  },
}
