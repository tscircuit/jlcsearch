import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

interface LEDSegmentDisplay {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  package?: string
  positions?: string
  type?: string
  size?: string
  color?: string
}

export const ledSegmentDisplayTableSpec: DerivedTableSpec<LEDSegmentDisplay> = {
  tableName: "led_segment_display",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "positions", type: "text" },
    { name: "type", type: "text" },
    { name: "size", type: "text" },
    { name: "color", type: "text" },
  ],

  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) => eb("description", "like", "%LED Segment Display%"))
  },

  mapToTable(components) {
    return components.map((c) => {
      try {
        const extraData = c.extra ? JSON.parse(c.extra) : {}
        const attrs = extraData.attributes || {}

        let positions = undefined
        const posMatch = c.description.match(/(\d+)\s*[Pp]ositions?/)
        if (posMatch) {
          positions = posMatch[1]
        }

        let type = undefined
        if (c.description.includes("Common Cathode")) {
          type = "Common Cathode"
        } else if (c.description.includes("Common Anode")) {
          type = "Common Anode"
        }

        let size = undefined
        const sizeMatch = c.description.match(/(\d+\.\d+)/)
        if (sizeMatch) {
          size = sizeMatch[1]
        }

        let color = undefined
        if (c.description.includes("Red")) {
          color = "Red"
        }

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          package: String(c.package || ""),
          positions,
          type,
          size,
          color,
        }
      } catch (e) {
        return null
      }
    })
  },
}
