import type { DerivedTableSpec } from "./types"
import type { SelectQueryBuilder, Generated } from "kysely"
import type { Component } from "../generated/kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"

type UnwrapGenerated<T> = {
  [K in keyof T]: T[K] extends Generated<infer U> ? U : T[K]
}
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseIntOrNull } from "lib/util/parse-int-or-null"
import { BaseComponent } from "./component-base"

export interface LedDriver extends BaseComponent {
  // Optional LED driver specific fields
  package?: string
  supply_voltage_min?: number
  supply_voltage_max?: number
  output_current_max?: number
  channel_count?: number
  dimming_method?: string
  efficiency_percent?: number
  operating_temp_min?: number
  operating_temp_max?: number
  protection_features?: string
  mounting_style?: string
}

export const ledDriverTableSpec: DerivedTableSpec<LedDriver> = {
  tableName: "led_driver",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "output_current_max", type: "real" },
    { name: "channel_count", type: "integer" },
    { name: "dimming_method", type: "text" },
    { name: "efficiency_percent", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "protection_features", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "LED Drivers"),
          eb("description", "like", "%LED Driver%"),
          eb("description", "like", "%LED Controller%"),
        ]),
      )
  },
  mapToTable(components: UnwrapGenerated<Component>[]): (LedDriver | null)[] {
    return components.map((c) => {
      try {
        const attrs = c.extra ? JSON.parse(c.extra)?.attributes || {} : {}

        // Helper to parse voltage/current values that might be in various formats
        const parseValue = (val: string | undefined): number | undefined => {
          if (!val) return undefined
          const result = parseAndConvertSiUnit(val)
          return result?.value || undefined
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
          is_extended_promotional: Boolean(c.extended_promotional),
          package: String(c.package || ""),
          supply_voltage_min: parseValue(attrs["Input Voltage"]?.split("~")[0]),
          supply_voltage_max: parseValue(attrs["Input Voltage"]?.split("~")[1]),
          output_current_max: parseValue(attrs["Output Current"]),
          channel_count:
            parseIntOrNull(attrs["Channels"]) ??
            parseIntOrNull(attrs["Number of Outputs"]) ??
            undefined,
          dimming_method: attrs["Dimming"] ?? attrs["Dimming Method"],
          efficiency_percent: attrs["Efficiency"]
            ? parseFloat(attrs["Efficiency"])
            : undefined,
          operating_temp_min: parseValue(
            attrs["Operating temperature"]?.split("~")[0],
          ),
          operating_temp_max: parseValue(
            attrs["Operating temperature"]?.split("~")[1],
          ),
          protection_features: attrs["Protection Features"],
          mounting_style: attrs["Mounting Style"],
          attributes: attrs,
        }
      } catch (e) {
        return null
      }
    })
  },
}
