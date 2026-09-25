import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface SpringClampTerminalBlock extends BaseComponent {
  package: string
  pitch_mm: number | null
  num_pins: number | null
  voltage_rating: number | null
  current_rating: number | null
  wire_gauge_mm2: number | null
  wire_gauge_awg: string | null
  mounting_style: string | null
}

const parseUnit = (value?: string | null) => {
  if (!value || value === "-") return null
  const parsed = parseAndConvertSiUnit(value).value
  return typeof parsed === "number" && !Number.isNaN(parsed) ? parsed : null
}

const parseInteger = (value?: string | null) => {
  if (!value) return null
  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ""), 10)
  return Number.isNaN(parsed) ? null : parsed
}

export const springClampTerminalBlockTableSpec: DerivedTableSpec<SpringClampTerminalBlock> =
  {
    tableName: "spring_clamp_terminal_block",
    extraColumns: [
      { name: "package", type: "text" },
      { name: "pitch_mm", type: "real" },
      { name: "num_pins", type: "integer" },
      { name: "voltage_rating", type: "real" },
      { name: "current_rating", type: "real" },
      { name: "wire_gauge_mm2", type: "real" },
      { name: "wire_gauge_awg", type: "text" },
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
        .where(
          "categories.subcategory",
          "=",
          "Spring Clamp System Terminal Block",
        )
    },
    mapToTable(components) {
      return components.map((c) => {
        try {
          const extra = c.extra ? JSON.parse(c.extra) : {}
          const attrs: Record<string, string> = extra.attributes || {}

          return {
            lcsc: Number(c.lcsc),
            mfr: String(c.mfr || ""),
            description: String(c.description || ""),
            stock: Number(c.stock || 0),
            price1: extractMinQPrice(c.price),
            in_stock: Boolean((c.stock || 0) > 0),
            is_basic: Boolean(c.basic),
            is_preferred: Boolean(c.preferred),
            is_extended_promotional: Boolean(c.preferred && !c.basic),
            package: String(c.package || ""),
            pitch_mm: parseUnit(attrs["Pitch"]),
            num_pins: parseInteger(attrs["Number of PINs Per Row"]),
            voltage_rating: parseUnit(attrs["Voltage Rating (Max)"]),
            current_rating: parseUnit(attrs["Current Rating (Max)"]),
            wire_gauge_mm2: parseUnit(attrs["Wire Gauge - mm2"]),
            wire_gauge_awg: attrs["Wire Gauge - AWG"] || null,
            mounting_style: attrs["Mounting Style"] || null,
            attributes: attrs,
          }
        } catch {
          return null
        }
      })
    },
  }
