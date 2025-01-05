import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

interface OLEDDisplay {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  package?: string
  protocol?: string
  size?: string
  pixelResolution?: string
}

export const oledDisplayTableSpec: DerivedTableSpec<OLEDDisplay> = {
  tableName: "oled_display",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "protocol", type: "text" },
    { name: "size", type: "text" },
    { name: "pixelResolution", type: "text" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) => eb("description", "like", "%OLED Display%"))
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const extraData = c.extra ? JSON.parse(c.extra) : {}
        const attrs = extraData.attributes || {}

        // Extract protocol from description or interface attribute
        let protocol
        if (c.description.includes("I2C")) {
          protocol = "I2C"
        } else if (attrs.Interface) {
          protocol = attrs.Interface
        }

        // Extract size and resolution from description
        let size = undefined
        let pixelResolution = undefined

        const description = c.description || ""

        // Extract resolution (e.g., "128x64")
        const resMatch = description.match(/(\d+x\d+)/)
        if (resMatch) {
          pixelResolution = resMatch[1]
        }

        // Extract size (e.g., "0.96")
        const sizeMatch = description.match(/\s(\d+\.\d+)\s/)
        if (sizeMatch) {
          size = sizeMatch[1]
        }

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(description),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          package: String(c.package || ""),
          protocol: protocol || undefined,
          size,
          pixelResolution,
        }
      } catch (e) {
        return null
      }
    })
  },
}
