import { BaseComponent } from "lib/db/derivedtables/component-base"
import type { DerivedTableSpec } from "lib/db/derivedtables/types"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"

export interface HdmiPort extends BaseComponent {
  package: string
  mounting_style: string | null
  orientation: string | null
  gender: string | null
  number_of_pins: number | null
  number_of_rows: number | null
  current_rating_a: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
}

const HDMI_SUBCATEGORIES = [
  "HDMI Connectors",
  "D-Sub/DVI/HDMI Connectors",
  "D-Sub / VGA Connectors",
  "Audio & Video Connectors",
] as const

const parseNumber = (value: string | undefined): number | null => {
  if (!value || value === "-") return null
  const parsed = Number(parseAndConvertSiUnit(value).value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseInteger = (value: string | undefined): number | null => {
  if (!value || value === "-") return null
  const match = value.match(/\d+/)
  if (!match) return null
  const parsed = Number.parseInt(match[0], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const inferPinCount = (
  attrs: Record<string, string>,
  description: string,
): number | null =>
  parseInteger(attrs["Number of Pins"] ?? attrs["Number of Contacts"]) ??
  parseInteger(description.match(/\b\d+\s*(?:P|Pins?)\b/i)?.[0])

const inferMountingStyle = (
  attrs: Record<string, string>,
  packageName: string,
  description: string,
): string | null => {
  if (attrs["Mounting Style"] && attrs["Mounting Style"] !== "-") {
    return attrs["Mounting Style"]
  }

  const searchableText = `${packageName} ${description}`
  if (/\bSMD\b|surface mount/i.test(searchableText)) return "Surface Mount"
  if (/\bplugin\b|push-pull|through[- ]hole/i.test(searchableText)) {
    return "Through Hole"
  }
  return null
}

const inferOrientation = (description: string): string | null => {
  if (/horizontal attachment|right[- ]angle|bend insert/i.test(description)) {
    return "Horizontal"
  }
  if (/vertical attachment|straight insert/i.test(description)) {
    return "Vertical"
  }
  return null
}

const parseTemperatureRange = (
  value: string | undefined,
): [number | null, number | null] => {
  if (!value || !value.includes("~")) return [null, null]
  const [min, max] = value.split("~")
  return [parseNumber(min), parseNumber(max)]
}

export const hdmiPortTableSpec: DerivedTableSpec<HdmiPort> = {
  tableName: "hdmi_port",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "orientation", type: "text" },
    { name: "gender", type: "text" },
    { name: "number_of_pins", type: "integer" },
    { name: "number_of_rows", type: "integer" },
    { name: "current_rating_a", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  indexes: [
    { name: "idx_hdmi_port_stock", columns: ["stock"] },
    {
      name: "idx_hdmi_port_package_stock",
      columns: ["package", "stock"],
    },
    {
      name: "idx_hdmi_port_mounting_style_stock",
      columns: ["mounting_style", "stock"],
    },
    {
      name: "idx_hdmi_port_orientation_stock",
      columns: ["orientation", "stock"],
    },
    {
      name: "idx_hdmi_port_gender_stock",
      columns: ["gender", "stock"],
    },
    {
      name: "idx_hdmi_port_number_of_pins_stock",
      columns: ["number_of_pins", "stock"],
    },
    {
      name: "idx_hdmi_port_is_basic_stock",
      columns: ["is_basic", "stock"],
    },
    {
      name: "idx_hdmi_port_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "in", [...HDMI_SUBCATEGORIES])
  },
  mapToTable(components) {
    return components.map((component) => {
      try {
        const extra = component.extra ? JSON.parse(component.extra) : {}
        const attrs: Record<string, string> = extra.attributes || {}
        const description = String(component.description || "")
        const packageName = String(component.package || "")
        const hdmiText = [
          component.mfr,
          description,
          extra.title,
          attrs["Connector Type"],
        ]
          .filter(Boolean)
          .join(" ")

        if (!/\bHDMI\b/i.test(hdmiText)) return null

        const temperatureRange =
          attrs["Operating Temperature Range"] ?? attrs["Operating Temperature"]
        const [operatingTempMin, operatingTempMax] =
          parseTemperatureRange(temperatureRange)

        const gender =
          attrs.Gender && attrs.Gender !== "-"
            ? attrs.Gender
            : description.match(/\b(?:Female|Male)\b/i)?.[0]

        return {
          lcsc: Number(component.lcsc),
          mfr: String(component.mfr || ""),
          description,
          stock: Number(component.stock || 0),
          price1: extractMinQPrice(component.price),
          in_stock: Boolean((component.stock || 0) > 0),
          is_basic: Boolean(component.basic),
          is_preferred: Boolean(component.preferred),
          is_extended_promotional: Boolean(
            Number(component.preferred) === 1 && Number(component.basic) === 0,
          ),
          package: packageName,
          mounting_style: inferMountingStyle(attrs, packageName, description),
          orientation: inferOrientation(description),
          gender: gender
            ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase()
            : null,
          number_of_pins: inferPinCount(attrs, description),
          number_of_rows: parseInteger(attrs["Number of Rows"]),
          current_rating_a: parseNumber(
            attrs["Current Rating (Max)"] ??
              attrs["Current Rating-Signal (Max)"],
          ),
          operating_temp_min: operatingTempMin,
          operating_temp_max: operatingTempMax,
          attributes: attrs,
        }
      } catch {
        return null
      }
    })
  },
}
