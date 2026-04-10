import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

const FUSE_SUBCATEGORIES = [
  "Fuses",
  "Disposable Fuses",
  "Resettable Fuses",
  "Surface Mount Fuses",
  "PTC Resettable Fuses",
  "Automotive Fuses",
  "Cartridge Fuses",
  "Thermal Fuses (TCO)",
  "Thermal Cutoffs (TCO)",
] as const

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
      .where("categories.subcategory", "in", [...FUSE_SUBCATEGORIES])
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
          String(attrs.Type || ""),
        ].join(" ")

        // Extract current rating (e.g., "1A", "5A")
        let current_rating = undefined
        const currentSource =
          attrs["Current Rating"] ||
          attrs["Hold Current"] ||
          attrs["Current Rating (Max)"] ||
          textForParsing
        const currentMatch = String(currentSource).match(/(\d+(?:\.\d+)?)\s*(mA|A)/i)
        if (currentMatch) {
          current_rating =
            currentMatch[2].toLowerCase() === "ma"
              ? parseFloat(currentMatch[1]) / 1000
              : parseFloat(currentMatch[1])
        }

        // Extract voltage rating (e.g., "250V", "500V")
        let voltage_rating = undefined
        const voltageSource =
          attrs["Voltage Rating (DC)"] ||
          attrs["Voltage Rating  (AC)"] ||
          attrs["Operating Voltage (Max)"] ||
          textForParsing
        const voltageMatch = String(voltageSource).match(/(\d+(?:\.\d+)?)\s*V/i)
        if (voltageMatch) {
          voltage_rating = parseFloat(voltageMatch[1])
        }

        // Extract response time from attributes or description
        let response_time = attrs["Response Time"]?.toLowerCase() || "medium"
        if (!response_time) {
          if (textForParsing.toLowerCase().includes("fast")) response_time = "fast"
          else if (textForParsing.toLowerCase().includes("medium"))
            response_time = "medium"
          else if (textForParsing.toLowerCase().includes("slow"))
            response_time = "slow"
        }

        // Extract package type
        let package_type = c.package || ""
        if (!package_type) {
          if (textForParsing.toLowerCase().includes("axial")) package_type = "axial"
          else if (textForParsing.toLowerCase().includes("radial"))
            package_type = "radial"
        }

        // Determine mount type
        const is_surface_mount =
          textForParsing.toLowerCase().includes("smd") ||
          !textForParsing.toLowerCase().includes("through")

        // Determine glass encased
        const is_glass_encased = textForParsing.toLowerCase().includes("glass")

        // Determine if resettable
        const is_resettable =
          textForParsing.toLowerCase().includes("resettable") ||
          textForParsing.toLowerCase().includes("ptc")

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description,
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
        is_extended_promotional: Boolean(c.extended_promotional || false),
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
