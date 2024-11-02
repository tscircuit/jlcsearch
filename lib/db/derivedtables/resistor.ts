import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"

interface Resistor {
  lcsc: number
  mfr: string
  description: string
  stock: number
  in_stock: boolean
  attributes: Record<string, string>

  // Extra columns
  resistance: number
  tolerance_fraction: number
  power_watts: number
}

export const resistorTableSpec: DerivedTableSpec<Resistor> = {
  tableName: "resistor",
  extraColumns: [
    { name: "resistance", type: "real" },
    { name: "tolerance_fraction", type: "real" },
    { name: "power_watts", type: "real" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.category", "=", "Resistors"),
  mapToTable: (components) => {
    return components.map((c): Resistor | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null
      const rawResistance = extra?.attributes?.["Resistance"]
      const rawTolerance = extra?.attributes?.["Tolerance"]
      const rawPower = extra?.attributes?.["Power(Watts)"]

      const resistance = parseAndConvertSiUnit(rawResistance).value as number
      const tolerance = parseAndConvertSiUnit(rawTolerance).value as number
      const power_watts = parseAndConvertSiUnit(rawPower).value as number

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        in_stock: c.in_stock,
        resistance: resistance,
        tolerance_fraction: tolerance,
        power_watts,
        attributes: extra.attributes,
      }
    })
  },
}
