import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { BaseComponent } from "./component-base"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

const LED_SEGMENT_SUBCATEGORIES = [
  "Led Segment Display",
  "LED Segment Displays",
] as const

export interface LEDSegmentDisplay extends BaseComponent {
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
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],

  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "in", [...LED_SEGMENT_SUBCATEGORIES])
  },

  mapToTable(components) {
    return components.map((c) => {
      try {
        const extraData = c.extra ? JSON.parse(c.extra) : {}
        const attrs = extraData.attributes || {}
        const description = String(c.description || extraData.description || "")
        const textForParsing = [
          description,
          String(extraData.title || ""),
          String(extraData.mpn || ""),
        ].join(" ")

        let positions = undefined
        const posMatch =
          String(attrs["Number of Characters"] || "").match(/(\d+)\s*Bit/i) ||
          textForParsing.match(/(\d+)\s*Bit/i) ||
          textForParsing.match(/(\d+)\s*[Pp]ositions?/)
        if (posMatch) {
          positions = posMatch[1]
        }

        let type = undefined
        const polarity = String(attrs["LED Polarity"] || "")
        if (
          textForParsing.toLowerCase().includes("common cathode") ||
          polarity.toLowerCase().includes("common cathode")
        ) {
          type = "Common Cathode"
        } else if (
          textForParsing.toLowerCase().includes("common anode") ||
          polarity.toLowerCase().includes("common anode")
        ) {
          type = "Common Anode"
        }

        let size = attrs["Digit/Alpha Size(inch)"] || undefined
        const sizeMatch = textForParsing.match(/(\d+\.\d+)/)
        if (sizeMatch) {
          // keep attribute-derived size when present, otherwise use description
          // fallback
          size ??= sizeMatch[1]
        }

        let color = attrs["Luminous Color"] || undefined
        if (!color && textForParsing.includes("Red")) color = "Red"

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description,
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
          is_extended_promotional: Boolean(c.preferred) && !Boolean(c.basic),
          package: String(c.package || ""),
          positions,
          type,
          size,
          color,
          attributes: attrs,
        }
      } catch (e) {
        return null
      }
    })
  },
}
