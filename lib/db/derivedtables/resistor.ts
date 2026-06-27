import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Resistor extends BaseComponent {
  resistance: number
  tolerance_fraction: number
  power_watts: number
  package: string
  max_overload_voltage: number | null
  number_of_resistors: number | null
  number_of_pins: number | null
  is_potentiometer: boolean
  is_surface_mount: boolean
  is_multi_resistor_chip: boolean
}

export const resistorTableSpec: DerivedTableSpec<Resistor> = {
  tableName: "resistor",
  extraColumns: [
    { name: "resistance", type: "real" },
    { name: "tolerance_fraction", type: "real" },
    { name: "power_watts", type: "real" },
    { name: "package", type: "text" },
    { name: "max_overload_voltage", type: "real" },
    { name: "number_of_resistors", type: "integer" },
    { name: "number_of_pins", type: "integer" },
    { name: "is_potentiometer", type: "boolean" },
    { name: "is_surface_mount", type: "boolean" },
    { name: "is_multi_resistor_chip", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
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

      // Extract additional fields
      const maxVoltage = parseAndConvertSiUnit(
        extra?.attributes?.["Overload Voltage (Max)"],
      ).value as number
      const numResistors =
        parseInt(extra?.attributes?.["Number of Resistors"]) || null
      const numPins = parseInt(extra?.attributes?.["Number of Pins"]) || null
      const isPotentiometer = c.description
        .toLowerCase()
        .includes("potentiometer")
      const isSurfaceMount =
        c.package?.toLowerCase().includes("smd") ||
        !c.package?.toLowerCase().includes("plugin")

      // Determine if this is a multi-resistor chip
      const isMultiResistorChip = Boolean(
        (numResistors && numResistors > 1) ||
          c.description.toLowerCase().includes("array") ||
          c.description.toLowerCase().includes("network") ||
          c.package?.toLowerCase().includes("x"),
      )

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price)!,
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        resistance: resistance,
        tolerance_fraction: tolerance,
        power_watts,
        package: c.package || "",
        max_overload_voltage: maxVoltage,
        number_of_resistors: numResistors,
        number_of_pins: numPins,
        is_potentiometer: isPotentiometer,
        is_surface_mount: isSurfaceMount,
        is_multi_resistor_chip: isMultiResistorChip,
        attributes: extra.attributes,
      }
    })
  },
}
