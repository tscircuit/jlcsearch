import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"
import type { KyselyDatabaseInstance } from "../kysely-types"

export interface UsbCConnector extends BaseComponent {
  package: string
  mounting_style: string | null
  current_rating_a: number | null
  number_of_ports: number | null
  number_of_contacts: number | null
  gender: string | null
  operating_temp_min: number | null
  operating_temp_max: number | null
}

export const usbCConnectorTableSpec: DerivedTableSpec<UsbCConnector> = {
  tableName: "usb_c_connector",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "current_rating_a", type: "real" },
    { name: "number_of_ports", type: "integer" },
    { name: "number_of_contacts", type: "integer" },
    { name: "gender", type: "text" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "=", "USB Connectors")
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

        let tempMin: number | null = null
        let tempMax: number | null = null
        const tempRange = attrs["Operating Temperature Range"]
        if (tempRange && tempRange.includes("~")) {
          const [min, max] = tempRange.split("~")
          tempMin = parseNum(min)
          tempMax = parseNum(max)
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
          is_preferred: Boolean(c.preferred),
          package: String(c.package || ""),
          mounting_style: attrs["Mounting Style"] || null,
          current_rating_a: parseNum(attrs["Current Rating - Power (Max)"]),
          number_of_ports: parseInt(attrs["Number of Ports"] || "") || null,
          number_of_contacts: isNaN(contacts) ? null : contacts,
          gender: attrs["Gender"] || null,
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
