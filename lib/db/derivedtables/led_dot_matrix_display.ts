import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

interface LEDDotMatrixDisplay {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  package?: string
  matrix_size?: string
  color?: string
}

export const ledDotMatrixDisplayTableSpec: DerivedTableSpec<LEDDotMatrixDisplay> =
  {
    tableName: "led_dot_matrix_display",
    extraColumns: [
      { name: "package", type: "text" },
      { name: "matrix_size", type: "text" },
      { name: "color", type: "text" },
    ],
    listCandidateComponents(db: KyselyDatabaseInstance) {
      return db
        .selectFrom("components")
        .innerJoin("categories", "components.category_id", "categories.id")
        .selectAll()
        .where((eb) => eb("description", "like", "%LED Dot Matrix%"))
    },
    mapToTable(components) {
      return components.map((c) => {
        try {
          const extraData = c.extra ? JSON.parse(c.extra) : {}
          const attrs = extraData.attributes || {}

          // Extract matrix size from description (e.g., "8x8", "16x32")
          let matrix_size = undefined
          const sizeMatch = c.description.match(/(\d+x\d+)/)
          if (sizeMatch) {
            matrix_size = sizeMatch[1]
          }

          // Extract color from description or attributes
          let color = attrs.Color || undefined
          if (!color) {
            if (c.description.includes("Red")) color = "Red"
            else if (c.description.includes("Green")) color = "Green"
            else if (c.description.includes("Blue")) color = "Blue"
            else if (c.description.includes("RGB")) color = "RGB"
          }

          return {
            lcsc: Number(c.lcsc),
            mfr: String(c.mfr || ""),
            description: String(c.description || ""),
            stock: Number(c.stock || 0),
            price1: extractMinQPrice(c.price),
            in_stock: Boolean((c.stock || 0) > 0),
            package: String(c.package || ""),
            matrix_size,
            color,
          }
        } catch (e) {
          return null
        }
      })
    },
  }
