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

export interface Mosfet extends BaseComponent {
  package?: string
  drain_source_voltage?: number
  continuous_drain_current?: number
  gate_threshold_voltage?: number
  power_dissipation?: number
  operating_temp_min?: number
  operating_temp_max?: number
  mounting_style?: string
}

export const mosfetTableSpec: DerivedTableSpec<Mosfet> = {
  tableName: "mosfet",
  extraColumns: [
    { name: "kicad_footprint", type: "text" },
    { name: "jlc_part_number", type: "text" },
    { name: "package", type: "text" },
    { name: "drain_source_voltage", type: "real" },
    { name: "continuous_drain_current", type: "real" },
    { name: "gate_threshold_voltage", type: "real" },
    { name: "power_dissipation", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "mounting_style", type: "text" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "MOSFETs"),
          eb("description", "like", "%MOSFET%"),
        ]),
      )
  },
  mapToTable(components: UnwrapGenerated<Component>[]): (Mosfet | null)[] {
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
          kicad_footprint: c.kicad_footprint,
          jlc_part_number: c.jlc_part_number,
          drain_source_voltage: parseValue(
            attrs["Drain Source Voltage (Vdss)"],
          ),
          continuous_drain_current: parseValue(
            attrs["Continuous Drain Current (Id)"],
          ),
          gate_threshold_voltage: parseValue(
            attrs["Gate Threshold Voltage (Vgs(th)@Id)"],
          ),
          power_dissipation: parseValue(attrs["Power Dissipation (Pd)"]),
          operating_temp_min: parseValue(
            attrs["Operating temperature"]?.split("~")[0],
          ),
          operating_temp_max: parseValue(
            attrs["Operating temperature"]?.split("~")[1],
          ),
          mounting_style: attrs["Mounting Style"],
          attributes: attrs,
        }
      } catch (e) {
        return null
      }
    })
  },
}
