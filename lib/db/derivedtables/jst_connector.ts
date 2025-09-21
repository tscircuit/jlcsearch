import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"
import type { KyselyDatabaseInstance } from "../kysely-types"

export interface JstConnector extends BaseComponent {
  package: string
  pitch_mm: number | null
  num_rows: number | null
  num_pins: number | null
  reference_series: string | null
}

export const jstConnectorTableSpec: DerivedTableSpec<JstConnector> = {
  tableName: "jst_connector",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "pitch_mm", type: "real" },
    { name: "num_rows", type: "integer" },
    { name: "num_pins", type: "integer" },
    { name: "reference_series", type: "text" },
    { name: "is_basic", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.category", "like", "Connectors%")
      .where("components.extra", "like", "%JST%")
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

        let numRows = parseInt(attrs["Number of Rows"] || "")
        if (isNaN(numRows)) numRows = 1

        let pinsPerRow = parseInt(attrs["Number of PINs Per Row"] || "")
        const structure = attrs["Pins Structure"]
        if ((isNaN(pinsPerRow) || !pinsPerRow) && structure) {
          const m = structure.match(/(\d+)x(\d+)/)
          if (m) {
            numRows = parseInt(m[1])
            pinsPerRow = parseInt(m[2])
          }
        }

        let numPins = parseInt(attrs["Number of Pins"] || "")
        if (isNaN(numPins) && pinsPerRow && numRows) {
          numPins = pinsPerRow * numRows
        }

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          package: String(c.package || ""),
          pitch_mm: parseNum(attrs["Pitch"]),
          num_rows: isNaN(numRows) ? null : numRows,
          num_pins: isNaN(numPins) ? null : numPins,
          reference_series: attrs["Reference Series"] || null,
          attributes: attrs,
        }
      } catch {
        return null
      }
    })
  },
}
