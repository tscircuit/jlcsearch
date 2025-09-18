import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { parseIntOrNull } from "lib/util/parse-int-or-null"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"
import type { KyselyDatabaseInstance } from "../kysely-types"

export interface Relay extends BaseComponent {
  package: string
  relay_type: string
  contact_form: string | null
  coil_voltage: number | null
  coil_resistance: number | null
  max_switching_current: number | null
  max_switching_voltage: number | null
  pin_number: number | null
}

export const relayTableSpec: DerivedTableSpec<Relay> = {
  tableName: "relay",
  extraColumns: [
    { name: "kicad_footprint", type: "text" },
    { name: "jlc_part_number", type: "text" },
    { name: "package", type: "text" },
    { name: "relay_type", type: "text" },
    { name: "contact_form", type: "text" },
    { name: "coil_voltage", type: "real" },
    { name: "coil_resistance", type: "real" },
    { name: "max_switching_current", type: "real" },
    { name: "max_switching_voltage", type: "real" },
    { name: "pin_number", type: "integer" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.and([
          eb("categories.subcategory", "like", "%Relay%"),
          eb("categories.subcategory", "not like", "%Accessory%"),
        ]),
      )
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const extra = c.extra ? JSON.parse(c.extra) : {}
        const attrs: Record<string, string> = extra.attributes || {}

        const parseValue = (val: string | undefined): number | null => {
          if (!val || val === "-") return null
          return parseAndConvertSiUnit(val).value as number
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
          relay_type: (c as any).subcategory || "",
          contact_form: attrs["Contact Form"] || null,
          coil_voltage: parseValue(attrs["Coil Voltage"]),
          coil_resistance: parseValue(attrs["Coil Resistance"]),
          max_switching_current: parseValue(attrs["Maximum Switching Current"]),
          max_switching_voltage: parseValue(attrs["Maximum Switching Voltage"]),
          pin_number: parseIntOrNull(attrs["Pin Number"]),
          attributes: attrs,
        }
      } catch {
        return null
      }
    })
  },
}
