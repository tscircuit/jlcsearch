import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface PcieM2Connector extends BaseComponent {
  key: string | null
  is_right_angle: boolean
}

export const pcieM2ConnectorTableSpec: DerivedTableSpec<PcieM2Connector> = {
  tableName: "pcie_m2_connector",
  extraColumns: [
    { name: "key", type: "text" },
    { name: "is_right_angle", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where(
        "categories.subcategory",
        "=",
        "Hard Disk Connector (SAS/SATA/M.2)",
      ),
  mapToTable(components) {
    return components.map((c) => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      const attrs: Record<string, string> = extra.attributes || {}

      const interfaceForm = attrs["Interface Form"] || ""
      let key: string | null = null
      const keyMatch = interfaceForm.match(/M\.2-(\w) Key/i)
      if (keyMatch) key = keyMatch[1]

      const mounting =
        attrs["Mounting Type"] || attrs["Mounting Style"] || c.description
      const isRightAngle = /horizontal/i.test(mounting)

      return {
        lcsc: Number(c.lcsc),
        mfr: String(c.mfr || ""),
        description: String(c.description || ""),
        stock: Number(c.stock || 0),
        price1: extractMinQPrice(c.price),
        in_stock: Boolean((c.stock || 0) > 0),
        is_basic_part: c.basic === 1,
        key,
        is_right_angle: isRightAngle,
        attributes: attrs,
      }
    })
  },
}
