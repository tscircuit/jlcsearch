import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { BaseComponent } from "./component-base"
import { createDerivedTableSpec } from "./create-derived-table-spec"

export interface FpcConnector extends BaseComponent {
  pitch_mm: number | null
  number_of_contacts: number | null
  contact_type: string | null
  locking_feature: string | null
}

export const fpcConnectorTableSpec = createDerivedTableSpec<FpcConnector>({
  tableName: "fpc_connector",
  extraColumns: [
    { name: "pitch_mm", type: "real" },
    { name: "number_of_contacts", type: "integer" },
    { name: "contact_type", type: "text" },
    { name: "locking_feature", type: "text" },
  ],
  subcategories: ["FFC/FPC Connectors", "FFC, FPC Connectors"],
  mapComponent: (_c, attrs) => {
    try {
      const parseNum = (v: string | undefined): number | null => {
        if (!v || v === "-") return null
        return parseAndConvertSiUnit(v).value as number
      }

      const contacts = parseInt(
        (attrs["Number of Contacts"] || "").replace(/[^0-9]/g, ""),
      )

      return {
        pitch_mm: parseNum(attrs["Pitch"]),
        number_of_contacts: isNaN(contacts) ? null : contacts,
        contact_type: attrs["Contact Type"] || null,
        locking_feature: attrs["Locking Feature"] || null,
      }
    } catch {
      return null
    }
  },
})
