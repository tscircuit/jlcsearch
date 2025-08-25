import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface ScrewTerminalBlock extends BaseComponent {
  pitch_mm: number | null
  number_of_pins: number | null
  current_rating_a: number | null
  voltage_rating_v: number | null
}

export const screwTerminalBlockTableSpec: DerivedTableSpec<ScrewTerminalBlock> =
  {
    tableName: "screw_terminal_block",
    extraColumns: [
      { name: "pitch_mm", type: "real" },
      { name: "number_of_pins", type: "integer" },
      { name: "current_rating_a", type: "real" },
      { name: "voltage_rating_v", type: "real" },
    ],
    listCandidateComponents: (db) =>
      db
        .selectFrom("components")
        .innerJoin("categories", "components.category_id", "categories.id")
        .selectAll()
        .where("categories.subcategory", "=", "Screw Terminal Blocks"),
    mapToTable(components) {
      return components.map((c) => {
        try {
          const extra = c.extra ? JSON.parse(c.extra) : {}
          const attrs: Record<string, string> = extra.attributes || {}

          const parsePitch = (v: string | undefined): number | null => {
            if (!v) return null
            const match = v.match(/([0-9.]+)\s*mm/i)
            return match ? parseFloat(match[1]) : null
          }

          const parseNum = (v: string | undefined): number | null => {
            if (!v || v === "-") return null
            return parseAndConvertSiUnit(v).value as number
          }

          const pitch = parsePitch(attrs["Pitch"])

          const pinsStr =
            attrs["Number of Pins"] ||
            attrs["Number of PINs Per Row"] ||
            attrs["Number of Positions or Pins"] ||
            ""
          const pins = parseInt(pinsStr.replace(/[^0-9]/g, ""))
          const current = parseNum(
            attrs["Current Rating (Max)"] || attrs["Rated Current"],
          )
          const voltage = parseNum(attrs["Voltage Rating (Max)"])

          return {
            lcsc: Number(c.lcsc),
            mfr: String(c.mfr || ""),
            description: String(c.description || ""),
            stock: Number(c.stock || 0),
            price1: extractMinQPrice(c.price),
            in_stock: Boolean((c.stock || 0) > 0),
            pitch_mm: pitch,
            number_of_pins: isNaN(pins) ? null : pins,
            current_rating_a: current,
            voltage_rating_v: voltage,
            attributes: attrs,
          }
        } catch {
          return null
        }
      })
    },
  }
