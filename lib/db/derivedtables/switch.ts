import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Switch extends BaseComponent {
  package: string
  switch_type: string
  circuit: string | null
  current_rating_a: number | null
  voltage_rating_v: number | null
  mounting_style: string | null
  is_latching: boolean | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  pin_count: number | null
  width_mm: number | null
  length_mm: number | null
  switch_height_mm: number | null
}

export const switchTableSpec: DerivedTableSpec<Switch> = {
  tableName: "switch",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "switch_type", type: "text" },
    { name: "circuit", type: "text" },
    { name: "current_rating_a", type: "real" },
    { name: "voltage_rating_v", type: "real" },
    { name: "mounting_style", type: "text" },
    { name: "is_latching", type: "boolean" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "pin_count", type: "integer" },
    { name: "width_mm", type: "real" },
    { name: "length_mm", type: "real" },
    { name: "switch_height_mm", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents(db) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.and([
          eb("categories.category", "like", "%Switch%"),
          eb("categories.subcategory", "not like", "%Relay%"),
          eb("categories.subcategory", "not like", "%Accessory%"),
        ]),
      )
  },
  mapToTable(components) {
    return components.map((c) => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      const attrs = extra.attributes || {}

      const parseNum = (val: string | undefined): number | null => {
        if (!val) return null
        return parseAndConvertSiUnit(val).value as number
      }

      let isLatching: boolean | null = null
      const lockField =
        attrs["Self Lock / No Lock"] || attrs["self lock / no lock"]
      if (lockField) {
        isLatching = lockField.toLowerCase().includes("latch") ? true : false
      }

      const tempRange = attrs["Operating Temperature"]
      let tempMin: number | null = null
      let tempMax: number | null = null
      if (tempRange && tempRange.includes("~")) {
        const [min, max] = tempRange.split("~")
        tempMin = parseNum(min)
        tempMax = parseNum(max)
      }

      const width = parseNum(attrs["Switch Width"])
      const length = parseNum(attrs["Switch Length"])
      const switchHeight = parseNum(attrs["Switch Height"])

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price)!,
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        package: c.package || "",
        switch_type: (c as any).subcategory || "",
        circuit: attrs["Circuit"] || null,
        current_rating_a:
          parseNum(attrs["Current Rating (DC)"] || attrs["Contact Current"]) ||
          parseNum(attrs["Current Rating (AC)"]),
        voltage_rating_v:
          parseNum(attrs["Voltage Rating (DC)"]) ||
          parseNum(attrs["Voltage Rating (AC)"]),
        mounting_style: attrs["Mounting Style"] || attrs["Pin Style"] || null,
        is_latching: isLatching,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        pin_count: c.joints ?? null,
        width_mm: width,
        length_mm: length,
        switch_height_mm: switchHeight,
        attributes: attrs,
      }
    })
  },
}
