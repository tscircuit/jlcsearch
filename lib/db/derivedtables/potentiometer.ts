import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { BaseComponent } from "./component-base"
import { createDerivedTableSpec } from "./create-derived-table-spec"

export interface Potentiometer extends BaseComponent {
  max_resistance: number
  pin_variant: "two_pin" | "three_pin"
  package: string
  is_surface_mount: boolean
}

export const potentiometerTableSpec = createDerivedTableSpec<Potentiometer>({
  tableName: "potentiometer",
  extraColumns: [
    { name: "max_resistance", type: "real" },
    { name: "pin_variant", type: "text" },
    { name: "package", type: "text" },
    { name: "is_surface_mount", type: "boolean" },
  ],
  category: "Resistors",
  subcategories: [
    "Potentiometers & Variable Resistors",
    "Potentiometers, Variable Resistors",
  ],
  mapComponent: (c, attrs) => {
    if (!c.extra || Object.keys(attrs).length === 0) return null

    const rawResistance = attrs["Resistance"]
    const maxResistance = parseAndConvertSiUnit(rawResistance).value as number

    // Determine pin variant based on number of pins
    const numPins = parseInt(attrs["Number of Pins"]) || 3
    const pinVariant = numPins === 2 ? "two_pin" : "three_pin"

    // Determine if surface mount
    const isSurfaceMount =
      c.package?.toLowerCase().includes("smd") ||
      !c.package?.toLowerCase().includes("plugin")

    return {
      max_resistance: maxResistance,
      pin_variant: pinVariant,
      package: c.package || "",
      is_surface_mount: isSurfaceMount,
    }
  },
})
