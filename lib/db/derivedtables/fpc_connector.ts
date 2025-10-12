import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"
import type { KyselyDatabaseInstance } from "../kysely-types"

export interface FpcConnector extends BaseComponent {
  pitch_mm: number | null
  number_of_contacts: number | null
  contact_type: string | null
  locking_feature: string | null
}

export const fpcConnectorTableSpec: DerivedTableSpec<FpcConnector> = {
  tableName: "fpc_connector",
  extraColumns: [
    { name: "pitch_mm", type: "real" },
    { name: "number_of_contacts", type: "integer" },
    { name: "contact_type", type: "text" },
    { name: "locking_feature", type: "text" },
    { name: "is_basic", type: "boolean" },
{ name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "in", [
        "FFC/FPC Connectors",
        "FFC, FPC Connectors",
      ])
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const extra = c.extra ? JSON.parse(c.extra) : {}
        const attrs: Record<string, string> = extra.attributes || {}

        const parseNum = (v: string | undefined): number | null => {
          if (!v || v === "-") return null
          return parseAndConvertSiUnit(v).value as number
        }

        const contacts = parseInt(
          (attrs["Number of Contacts"] || "").replace(/[^0-9]/g, ""),
        )

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.basic),
          pitch_mm: parseNum(attrs["Pitch"]),
          number_of_contacts: isNaN(contacts) ? null : contacts,
          contact_type: attrs["Contact Type"] || null,
          locking_feature: attrs["Locking Feature"] || null,
          attributes: attrs,
        }
      } catch {
        return null
      }
    })
  },
}
