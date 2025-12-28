import { getIsExtendedPromotional } from "lib/util/component-utils"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export interface WireToBoardConnector extends BaseComponent {
  package: string
  pitch_mm: number | null
  num_rows: number | null
  num_pins_per_row: number | null
  num_pins: number | null
  reference_series: string | null
  mounting_style: string | null
  gender: string | null
  is_smd: boolean
}

const parseNumber = (value?: string | null) => {
  const parsed = value ? parseFloat(value) : NaN
  return Number.isNaN(parsed) ? null : parsed
}

const parsePinsStructure = (structure?: string | null) => {
  if (!structure)
    return { rows: null as number | null, pinsPerRow: null as number | null }
  const match = structure.match(/(\d+)x(\d+)/)
  if (!match)
    return { rows: null as number | null, pinsPerRow: null as number | null }
  return {
    rows: parseNumber(match[1]),
    pinsPerRow: parseNumber(match[2]),
  }
}

const parsePitch = (pitch?: string | null) => {
  if (!pitch || pitch === "-") return null
  return parseAndConvertSiUnit(pitch).value as number
}

const deriveIsSmd = (mountingStyle: string | null, pkg: string | null) => {
  const mounting = mountingStyle?.toLowerCase() ?? ""
  const packageStr = pkg?.toLowerCase() ?? ""
  if (mounting.includes("surface")) return true
  if (packageStr.includes("smd") || packageStr.includes("smt")) return true
  return false
}

export const wireToBoardConnectorTableSpec: DerivedTableSpec<WireToBoardConnector> =
  {
    tableName: "wire_to_board_connector",
    extraColumns: [
      { name: "package", type: "text" },
      { name: "pitch_mm", type: "real" },
      { name: "num_rows", type: "integer" },
      { name: "num_pins_per_row", type: "integer" },
      { name: "num_pins", type: "integer" },
      { name: "reference_series", type: "text" },
      { name: "mounting_style", type: "text" },
      { name: "gender", type: "text" },
      { name: "is_smd", type: "boolean" },
      { name: "is_basic", type: "boolean" },
      { name: "is_preferred", type: "boolean" },
    ],
    listCandidateComponents(db: KyselyDatabaseInstance) {
      return db
        .selectFrom("components")
        .innerJoin("categories", "components.category_id", "categories.id")
        .selectAll()
        .where("categories.category", "like", "Connectors%")
        .where("categories.subcategory", "like", "Wire To Board%")
    },
    mapToTable(components) {
      return components.map((c) => {
        try {
          const extra = c.extra ? JSON.parse(c.extra) : {}
          const attrs: Record<string, string> = extra.attributes || {}

          const structure = parsePinsStructure(attrs["Pins Structure"])
          const numRows = parseNumber(attrs["Number of Rows"]) ?? structure.rows
          const pinsPerRow =
            parseNumber(attrs["Number of PINs Per Row"]) ?? structure.pinsPerRow

          const explicitPins = parseNumber(attrs["Number of Pins"])
          const computedPins =
            pinsPerRow && numRows ? pinsPerRow * numRows : (pinsPerRow ?? null)
          const numPins = explicitPins ?? computedPins

          const pitchMm = parsePitch(attrs["Pitch"])
          const mountingStyle = attrs["Mounting Style"] || null
          const gender = attrs["Gender"] || null
          const isSmd = deriveIsSmd(mountingStyle, c.package)

          return {
            lcsc: Number(c.lcsc),
            mfr: String(c.mfr || ""),
            description: String(c.description || ""),
            stock: Number(c.stock || 0),
            price1: extractMinQPrice(c.price),
            in_stock: Boolean((c.stock || 0) > 0),
            is_basic: Boolean(c.basic),
            is_preferred: Boolean(c.preferred),
            is_extended_promotional: getIsExtendedPromotional(c),
            package: String(c.package || ""),
            pitch_mm: pitchMm,
            num_rows: numRows,
            num_pins_per_row: pinsPerRow,
            num_pins: numPins,
            reference_series: attrs["Reference Series"] || null,
            mounting_style: mountingStyle,
            gender,
            is_smd: isSmd,
            attributes: attrs,
          }
        } catch (err) {
          return null
        }
      })
    },
  }
