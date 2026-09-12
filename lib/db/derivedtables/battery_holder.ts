import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"
import type { KyselyDatabaseInstance } from "../kysely-types"

export interface BatteryHolder extends BaseComponent {
  package: string
  connector_type: string | null
  battery_type: string | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  is_basic: boolean
  is_preferred: boolean
}

const BATTERY_CONNECTOR_SUBCATEGORIES = [
  "Battery Connectors",
  "Button And Strip Battery Connector",
  "Blade / Shrapnel Contact Battery Connectors",
  "Blade / Shrapnel Contact Battery Connector",
  "BatteryConnector",
]

export const batteryHolderTableSpec: DerivedTableSpec<BatteryHolder> = {
  tableName: "battery_holder",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "connector_type", type: "text" },
    { name: "battery_type", type: "text" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "in", BATTERY_CONNECTOR_SUBCATEGORIES)
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const extra = c.extra ? JSON.parse(c.extra) : {}
        const attrs: Record<string, string> = extra.attributes || {}

        const parseTemperature = (value: string | undefined): number | null => {
          if (!value || value === "-") return null
          try {
            return parseAndConvertSiUnit(value.replace("℃", "C"))
              .value as number
          } catch {
            return null
          }
        }

        let tempMin: number | null = null
        let tempMax: number | null = null
        const rawTemp = attrs["Operating Temperature Range"]
        if (rawTemp && rawTemp.includes("~")) {
          const [min, max] = rawTemp.split("~")
          tempMin = parseTemperature(min)
          tempMax = parseTemperature(max)
        }

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
          is_extended_promotional: false, // TODO: Populate from JLCPCB promotional data
          package: String(c.package || ""),
          connector_type: attrs["Connector Type"] || null,
          battery_type: attrs["Battery Type"] || null,
          operating_temp_min: tempMin,
          operating_temp_max: tempMax,
          attributes: attrs,
        }
      } catch {
        return null
      }
    })
  },
}
