import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

interface LCDDisplay {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  package?: string
  display_size?: string
  resolution?: string
  display_type?: string
}

export const lcdDisplayTableSpec: DerivedTableSpec<LCDDisplay> = {
  tableName: "lcd_display",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "display_size", type: "text" },
    { name: "resolution", type: "text" },
    { name: "display_type", type: "text" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) => eb("description", "like", "%LCD%"))
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const extraData = c.extra ? JSON.parse(c.extra) : {}
        const attrs = extraData.attributes || {}

        // Extract display size from description (e.g., "1.8 inch", "2.4\"")
        let display_size = undefined
        const sizeMatch = c.description.match(/(\d+\.?\d*)["\s]*(inch|"|'')?/)
        if (sizeMatch) {
          display_size = sizeMatch[1] + '"'
        }

        // Extract resolution from description (e.g., "128x64", "240x320")
        let resolution = undefined
        const resMatch = c.description.match(/(\d+x\d+)/)
        if (resMatch) {
          resolution = resMatch[1]
        }

        // Extract display type from description or attributes
        let display_type = attrs.Type || undefined
        if (!display_type) {
          if (c.description.includes("TFT")) display_type = "TFT"
          else if (c.description.includes("STN")) display_type = "STN"
          else if (c.description.includes("FSTN")) display_type = "FSTN"
        }

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          package: String(c.package || ""),
          display_size,
          resolution,
          display_type,
        }
      } catch (e) {
        return null
      }
    })
  },
}
