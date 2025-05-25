import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Battery extends BaseComponent {
  capacity: number // in mAh
  voltage: number // in Volts
  chemistry: string // e.g., "Li-ion", "NiMH", "Alkaline"
  package: string // e.g., "AA", "AAA", "18650"
  is_rechargeable: number // 1 for true, 0 for false
}

export const batteryTableSpec: DerivedTableSpec<Battery> = {
  tableName: "battery",
  extraColumns: [
    { name: "capacity", type: "real" },
    { name: "voltage", type: "real" },
    { name: "chemistry", type: "text" },
    { name: "package", type: "text" },
    { name: "is_rechargeable", type: "integer" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .select(["lcsc", "mfr", "description", "stock", "price", "extra"])
      .where("description", "like", "%battery%")
  },
  mapToTable(components) {
    return components
      .map((c) => {
        try {
          const extraData = c.extra ? JSON.parse(c.extra) : {}
          const attrs = extraData.attributes || {}

          // Extract capacity from description or attributes
          let capacity = attrs.Capacity || undefined
          if (!capacity) {
            const capacityMatch = c.description.match(/([\d\.]+)mAh/)
            if (capacityMatch) {
              capacity = parseFloat(capacityMatch[1])
            }
          }

          // Extract voltage from description or attributes
          let voltage = attrs.Voltage || undefined
          if (!voltage) {
            const voltageMatch = c.description.match(/([\d\.]+)V/)
            if (voltageMatch) {
              voltage = parseFloat(voltageMatch[1])
            }
          }

          // Extract chemistry from description or attributes
          let chemistry = attrs.Chemistry || undefined
          if (!chemistry) {
            if (c.description.includes("Li-ion")) chemistry = "Li-ion"
            else if (c.description.includes("NiMH")) chemistry = "NiMH"
            else if (c.description.includes("Alkaline")) chemistry = "Alkaline"
            else if (c.description.includes("Lithium")) chemistry = "Lithium"
            else chemistry = "Unknown"
          }

          // Extract package type from description or attributes
          let packageType = attrs.Package || undefined
          if (!packageType) {
            const packageMatch = c.description.match(
              /(AA|AAA|18650|CR2032|CR2025)/i,
            )
            if (packageMatch) {
              packageType = packageMatch[1]
            } else {
              packageType = "Custom"
            }
          }

          // Determine if rechargeable
          const isRechargeable = c.description
            .toLowerCase()
            .includes("rechargeable")

          return {
            lcsc: Number(c.lcsc),
            mfr: String(c.mfr || ""),
            description: String(c.description || ""),
            stock: Number(c.stock || 0),
            price1: extractMinQPrice(c.price),
            in_stock: Boolean((c.stock || 0) > 0),
            capacity: capacity || 0,
            voltage: voltage || 0,
            chemistry: chemistry || "Unknown",
            package: packageType || "Custom",
            is_rechargeable: isRechargeable ? 1 : 0,
            attributes: attrs,
          }
        } catch (e) {
          return null
        }
      })
      .filter((c): c is Battery => c !== null)
  },
}
