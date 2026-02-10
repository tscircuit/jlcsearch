import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Fuse extends BaseComponent {
  current_rating: number // in Amperes
  voltage_rating: number // in Volts
  response_time: string // "fast", "medium", "slow"
  package: string
  is_surface_mount: boolean
  is_glass_encased: boolean
  is_resettable: boolean
}

export const fuseTableSpec: DerivedTableSpec<Fuse> = {
  tableName: "fuse",
  extraColumns: [
    { name: "current_rating", type: "real" },
    { name: "voltage_rating", type: "real" },
    { name: "response_time", type: "text" },
    { name: "package", type: "text" },
    { name: "is_surface_mount", type: "boolean" },
    { name: "is_glass_encased", type: "boolean" },
    { name: "is_resettable", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) => eb("description", "like", "%fuse%"))
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const extraData = c.extra ? JSON.parse(c.extra) : {}
        const attrs = extraData.attributes || {}

        // Extract current rating (e.g., "1A", "5A")
        let current_rating = undefined
        const currentMatch = c.description.match(/(\d+(?:\.\d+)?)A/)
        if (currentMatch) {
          current_rating = parseFloat(currentMatch[1])
        }

        // Extract voltage rating (e.g., "250V", "500V")
        let voltage_rating = undefined
        const voltageMatch = c.description.match(/(\d+(?:\.\d+)?)V/)
        if (voltageMatch) {
          voltage_rating = parseFloat(voltageMatch[1])
        }

        // Extract response time from attributes or description
        let response_time = attrs["Response Time"]?.toLowerCase() || "medium"
        if (!response_time) {
          if (c.description.includes("fast")) response_time = "fast"
          else if (c.description.includes("medium")) response_time = "medium"
          else if (c.description.includes("slow")) response_time = "slow"
        }

        // Extract package type
        let package_type = c.package || ""
        if (!package_type) {
          if (c.description.includes("axial")) package_type = "axial"
          else if (c.description.includes("radial")) package_type = "radial"
        }

        // Determine mount type
        const is_surface_mount =
          c.description.toLowerCase().includes("smd") ||
          !c.description.toLowerCase().includes("through")

        // Determine glass encased
        const is_glass_encased = c.description.toLowerCase().includes("glass")

        // Determine if resettable
        const is_resettable =
          c.description.toLowerCase().includes("resettable") ||
          c.description.toLowerCase().includes("ptc")

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
        is_extended_promotional: Boolean(c.extended_promotional),
          current_rating: current_rating as number,
          voltage_rating: voltage_rating as number,
          response_time,
          package: package_type,
          is_surface_mount,
          is_glass_encased,
          is_resettable,
          attributes: attrs,
        }
      } catch (e) {
        return null
      }
    })
  },
}
