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

interface LEDWithIC {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  package?: string
  forward_voltage?: number
  current?: number
  color?: string
  mounting_style?: string
}

export const ledWithICTableSpec: DerivedTableSpec<LEDWithIC> = {
  tableName: "led_with_ic",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "forward_voltage", type: "real" },
    { name: "current", type: "real" },
    { name: "color", type: "text" },
    { name: "mounting_style", type: "text" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "LEDs (Built-in IC)"),
          eb("description", "like", "%LED%"),
          eb("description", "like", "%IC%"),
        ]),
      )
  },
  mapToTable(components: UnwrapGenerated<Component>[]): (LEDWithIC | null)[] {
    return components.map((c) => {
      try {
        const attrs = c.extra ? JSON.parse(c.extra)?.attributes || {} : {}

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
          package: String(c.package || ""),
          forward_voltage: parseValue(attrs["Forward Voltage"]),
          current: parseValue(attrs["Current"]),
          color: attrs["Color"],
          mounting_style: attrs["Mounting Style"],
        }
      } catch (e) {
        return null
      }
    })
  },
}
