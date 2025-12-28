import { getIsExtendedPromotional } from "lib/util/component-utils"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Potentiometer extends BaseComponent {
  max_resistance: number
  pin_variant: "two_pin" | "three_pin"
  package: string
  is_surface_mount: boolean
}

export const potentiometerTableSpec: DerivedTableSpec<Potentiometer> = {
  tableName: "potentiometer",
  extraColumns: [
    { name: "max_resistance", type: "real" },
    { name: "pin_variant", type: "text" },
    { name: "package", type: "text" },
    { name: "is_surface_mount", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.category", "=", "Resistors")
      .where("components.description", "like", "%potentiometer%"),
  mapToTable: (components) => {
    return components.map((c): Potentiometer | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const rawResistance = extra?.attributes?.["Resistance"]
      const maxResistance = parseAndConvertSiUnit(rawResistance).value as number

      // Determine pin variant based on number of pins
      const numPins = parseInt(extra?.attributes?.["Number of Pins"]) || 3
      const pinVariant = numPins === 2 ? "two_pin" : "three_pin"

      // Determine if surface mount
      const isSurfaceMount =
        c.package?.toLowerCase().includes("smd") ||
        !c.package?.toLowerCase().includes("plugin")

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price)!,
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        is_extended_promotional: getIsExtendedPromotional(c),
        max_resistance: maxResistance,
        pin_variant: pinVariant,
        package: c.package || "",
        is_surface_mount: isSurfaceMount,
        attributes: extra.attributes,
      }
    })
  },
}
