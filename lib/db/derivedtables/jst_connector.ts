import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { BaseComponent } from "./component-base"
import { createDerivedTableSpec } from "./create-derived-table-spec"

export interface JstConnector extends BaseComponent {
  package: string
  pitch_mm: number | null
  num_rows: number | null
  num_pins: number | null
  reference_series: string | null
}

export const jstConnectorTableSpec = createDerivedTableSpec<JstConnector>({
  tableName: "jst_connector",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "pitch_mm", type: "real" },
    { name: "num_rows", type: "integer" },
    { name: "num_pins", type: "integer" },
    { name: "reference_series", type: "text" },
  ],
  listCandidateComponents: (db: KyselyDatabaseInstance) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.category", "like", "Connectors%")
      .where("components.extra", "like", "%JST%"),
  mapComponent: (c, attrs) => {
    try {
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
        package: String(c.package || ""),
        pitch_mm: parseNum(attrs["Pitch"]),
        num_rows: isNaN(numRows) ? null : numRows,
        num_pins: isNaN(numPins) ? null : numPins,
        reference_series: attrs["Reference Series"] || null,
      }
    } catch {
      return null
    }
  },
})
