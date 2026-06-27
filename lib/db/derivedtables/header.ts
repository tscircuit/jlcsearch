import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface Header extends BaseComponent {
  // Extra columns
  package: string
  pitch_mm: number
  num_rows: number
  num_pins: number
  num_pins_per_row: number
  gender: "male" | "female" | "unknown"
  mounting_style: string | null
  pin_length_mm: number | null
  row_spacing_mm: number | null
  current_rating_amp: number | null
  voltage_rating_volt: number | null
  contact_material: string | null
  contact_plating: string | null
  insulation_height_mm: number | null
  operating_temperature_min: number | null
  operating_temperature_max: number | null
  is_shrouded: boolean
  is_right_angle: boolean
}

export const headerTableSpec: DerivedTableSpec<Header> = {
  tableName: "header",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "pitch_mm", type: "real" },
    { name: "num_rows", type: "integer" },
    { name: "num_pins", type: "integer" },
    { name: "num_pins_per_row", type: "integer" },
    { name: "gender", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "pin_length_mm", type: "real" },
    { name: "row_spacing_mm", type: "real" },
    { name: "current_rating_amp", type: "real" },
    { name: "voltage_rating_volt", type: "real" },
    { name: "contact_material", type: "text" },
    { name: "contact_plating", type: "text" },
    { name: "insulation_height_mm", type: "real" },
    { name: "operating_temperature_min", type: "real" },
    { name: "operating_temperature_max", type: "real" },
    { name: "is_shrouded", type: "boolean" },
    { name: "is_right_angle", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll("components")
      .select(["categories.subcategory as source_subcategory"])
      .where((wb) =>
        wb.or([
          wb("categories.subcategory", "=", "Female Headers"),
          wb("categories.subcategory", "=", "Pin Headers"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Header | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const sourceSubcategory =
        (c as typeof c & { source_subcategory?: string | null })
          .source_subcategory ?? ""
      const packageText = (c.package ?? "").toLowerCase()
      const searchableText = [c.description, c.mfr, extra.title]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
        .toLowerCase()

      // Parse pitch
      let pitch = null
      const rawPitch = attrs["Pitch"]
      if (rawPitch) {
        const match = rawPitch.match(/(\d+(?:\.\d+)?)\s*mm/)
        if (match) pitch = parseFloat(match[1])
      }
      if (!pitch && searchableText.includes("2.54mm")) pitch = 2.54
      if (!pitch && searchableText.includes("2.54")) pitch = 2.54
      if (!pitch) pitch = 2.54 // Default to standard 0.1" pitch

      // Parse number of pins and rows
      let numPins = parseInt(attrs["Number of Pins"]) || null
      let numRows = parseInt(attrs["Number of Rows"]) || 1
      let pinsPerRow = parseInt(attrs["Number of PINs Per Row"]) || null

      // Try to extract from structure field
      if (!numPins || !pinsPerRow) {
        const structure = attrs["Structure"] || attrs["Holes Structure"]
        if (structure) {
          const match = structure.match(/(\d+)x(\d+)/)
          if (match) {
            numRows = parseInt(match[1])
            pinsPerRow = parseInt(match[2])
            numPins = numRows * pinsPerRow
          }
        }
      }

      // If still no pins, try to extract from description
      if (!numPins) {
        const match = searchableText.match(/(\d+)\s*p\b/i)
        if (match) numPins = parseInt(match[1])
      }

      // Calculate missing values
      if (numPins && !pinsPerRow) pinsPerRow = Math.floor(numPins / numRows)
      if (pinsPerRow && !numPins) numPins = pinsPerRow * numRows

      // Determine gender
      let gender: "male" | "female" | "unknown" = "unknown"
      const rawGender = String(attrs["Gender"] ?? "").toLowerCase()
      if (sourceSubcategory === "Female Headers") {
        gender = "female"
      } else if (sourceSubcategory === "Pin Headers") {
        gender = "male"
      } else if (
        rawGender.includes("female") ||
        searchableText.includes("female") ||
        searchableText.includes("socket")
      ) {
        gender = "female"
      } else if (
        rawGender.includes("male") ||
        searchableText.includes("male") ||
        searchableText.includes("pin header") ||
        searchableText.includes("pin headers")
      ) {
        gender = "male"
      }

      // Parse temperatures
      let tempMin = null
      let tempMax = null
      const rawTemp = attrs["Operating Temperature Range"]
      if (rawTemp) {
        const match = rawTemp.match(/([-\d]+)℃~\+([-\d]+)℃/)
        if (match) {
          tempMin = parseInt(match[1])
          tempMax = parseInt(match[2])
        }
      }

      // Parse current rating
      let current = null
      const rawCurrent = attrs["Current Rating (Max)"]
      if (rawCurrent) {
        const match = rawCurrent.match(/(\d+(?:\.\d+)?)\s*A/)
        if (match) current = parseFloat(match[1])
      }

      // Parse voltage rating
      let voltage = null
      const rawVoltage = attrs["Voltage Rating (Max)"]
      if (rawVoltage) {
        const match = rawVoltage.match(/(\d+(?:\.\d+)?)\s*V/)
        if (match) voltage = parseFloat(match[1])
      }

      // Parse pin length
      let pinLength = null
      const rawPinLength = attrs["Length of End Connection Pin"]
      if (rawPinLength) {
        const match = rawPinLength.match(/(\d+(?:\.\d+)?)\s*mm/)
        if (match) pinLength = parseFloat(match[1])
      }

      // Parse row spacing
      let rowSpacing = null
      const rawSpacing = attrs["Row Spacing"]
      if (rawSpacing) {
        const match = rawSpacing.match(/(\d+(?:\.\d+)?)\s*mm/)
        if (match) rowSpacing = parseFloat(match[1])
      }

      // Parse insulation height
      let insulationHeight = null
      const rawHeight = attrs["Insulation Height"]
      if (rawHeight) {
        const match = rawHeight.match(/(\d+(?:\.\d+)?)\s*mm/)
        if (match) insulationHeight = parseFloat(match[1])
      }

      // Determine mounting style and angle
      const mountingStyle =
        attrs["Mounting Style"] || attrs["Mounting Type"] || null
      const mountingStyleText = mountingStyle?.toLowerCase() ?? ""
      const rightAngleHints = [
        "right angle",
        "right-angle",
        "bend",
        "brick nogging",
        "horizontal attachment",
        "side entry",
        "弯插",
        "卧贴",
        "侧插",
      ]
      const isRightAngle = rightAngleHints.some(
        (hint) =>
          mountingStyleText.includes(hint) ||
          packageText.includes(hint) ||
          searchableText.includes(hint),
      )

      // Determine if shrouded
      const isShrouded = Boolean(
        mountingStyleText.includes("shroud") ||
          searchableText.includes("shroud") ||
          searchableText.includes("box header"),
      )

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        in_stock: c.stock > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        price1: extractMinQPrice(c.price)!,
        package: c.package || "",
        pitch_mm: pitch,
        num_rows: numRows,
        num_pins: numPins || 0,
        num_pins_per_row: pinsPerRow || 0,
        gender,
        mounting_style: mountingStyle,
        pin_length_mm: pinLength,
        row_spacing_mm: rowSpacing,
        current_rating_amp: current,
        voltage_rating_volt: voltage,
        contact_material: attrs["Contact Material"] || null,
        contact_plating: attrs["Contact Plating"] || null,
        insulation_height_mm: insulationHeight,
        operating_temperature_min: tempMin,
        operating_temperature_max: tempMax,
        is_shrouded: isShrouded,
        is_right_angle: isRightAngle,
        attributes: attrs,
      }
    })
  },
}
