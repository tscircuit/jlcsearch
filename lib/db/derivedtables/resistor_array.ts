import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { DerivedTableSpec } from "./types"
import { BaseComponent } from "./component-base"

export interface ResistorArray extends BaseComponent {
  package: string
  resistance: number | null
  tolerance_fraction: number | null
  power_watts: number | null
  temperature_coefficient_ppm: number | null
  number_of_resistors: number | null
  number_of_pins: number | null
  topology: string | null
  is_surface_mount: boolean
  is_basic: boolean
  is_preferred: boolean
}

const computeTopology = (
  numberOfResistors: number | null,
  numberOfPins: number | null,
): string | null => {
  if (!numberOfResistors || !numberOfPins) return null

  if (numberOfPins === numberOfResistors * 2) {
    return "isolated"
  }

  if (numberOfPins === numberOfResistors + 1) {
    return "bussed"
  }

  if (numberOfPins === numberOfResistors + 2) {
    return "dual_terminated"
  }

  return "unknown"
}

const looksLikeArray = (
  description: string,
  packageName: string | null,
  numberOfResistors: number | null,
): boolean => {
  if (numberOfResistors && numberOfResistors > 1) return true

  const normalizedDescription = description.toLowerCase()
  const normalizedPackage = packageName?.toLowerCase() ?? ""

  return (
    normalizedDescription.includes("array") ||
    normalizedDescription.includes("network") ||
    /x\d+/.test(normalizedPackage)
  )
}

export const resistorArrayTableSpec: DerivedTableSpec<ResistorArray> = {
  tableName: "resistor_array",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "resistance", type: "real" },
    { name: "tolerance_fraction", type: "real" },
    { name: "power_watts", type: "real" },
    { name: "temperature_coefficient_ppm", type: "real" },
    { name: "number_of_resistors", type: "integer" },
    { name: "number_of_pins", type: "integer" },
    { name: "topology", type: "text" },
    { name: "is_surface_mount", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.category", "=", "Resistors"),
  mapToTable: (components) =>
    components.map((component) => {
      if (!component.extra) return null
      const extra = JSON.parse(component.extra ?? "{}")
      const attributes = extra.attributes ?? {}

      const numberOfResistors =
        Number.parseInt(attributes["Number of Resistors"] ?? "") || null
      const numberOfPins =
        Number.parseInt(attributes["Number of Pins"] ?? "") || null

      if (
        !looksLikeArray(
          component.description,
          component.package,
          numberOfResistors,
        )
      ) {
        return null
      }

      const resistance = parseAndConvertSiUnit(attributes["Resistance"])
        .value as number | null
      const tolerance = parseAndConvertSiUnit(attributes["Tolerance"]).value as
        | number
        | null
      const power = parseAndConvertSiUnit(attributes["Power(Watts)"]).value as
        | number
        | null
      const temperatureCoefficient = parseAndConvertSiUnit(
        attributes["Temperature Coefficient"],
      ).value as number | null

      const topology = computeTopology(numberOfResistors, numberOfPins)

      const isSurfaceMount =
        component.package?.toLowerCase().includes("smd") ||
        !component.package?.toLowerCase().includes("plugin")

      return {
        lcsc: component.lcsc,
        mfr: component.mfr,
        description: component.description,
        stock: component.stock,
        price1: extractMinQPrice(component.price)!,
        in_stock: component.stock > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        package: component.package ?? "",
        resistance,
        tolerance_fraction: tolerance,
        power_watts: power,
        temperature_coefficient_ppm: temperatureCoefficient,
        number_of_resistors: numberOfResistors,
        number_of_pins: numberOfPins,
        topology,
        is_surface_mount: Boolean(isSurfaceMount),
        attributes,
      }
    }),
}
