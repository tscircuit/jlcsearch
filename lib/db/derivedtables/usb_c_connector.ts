import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

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

const TYPE_C_PATTERN = /\b(?:usb[\s_-]*)?type[\s_-]*c\b|\busb[\s_-]*c\b/i
const NON_TYPE_C_CONNECTOR_PATTERN =
  /\b(?:usb[\s_-]*)?type[\s_-]*[ab]\b|\busb[\s_-]*[ab]\b|\bmicro[\s_-]*(?:usb|ab|a|b)\b|\bmini[\s_-]*(?:usb|ab|a|b)\b|\blightning[\s_-]*usb\b|\badapter\b/i
const FEMALE_GENDER_PATTERN =
  /\b(?:female|mother|receptacle|socket|jack)\b|母座|母/i
const MALE_GENDER_PATTERN = /\b(?:male|public|plug(?!-in\b))\b|公头|公/i

const readAttributes = (extraJson: string | null): Record<string, string> => {
  if (!extraJson) return {}

  try {
    const attributes = JSON.parse(extraJson)?.attributes
    if (!attributes || typeof attributes !== "object") return {}
    return attributes
  } catch {
    return {}
  }
}

const readText = (value: string | undefined): string | null => {
  const normalized = value?.trim()
  return normalized && normalized !== "-" ? normalized : null
}

const firstAttribute = (
  attributes: Record<string, string>,
  names: string[],
): string | null => {
  for (const name of names) {
    const value = readText(attributes[name])
    if (value) return value
  }
  return null
}

const parseNum = (value: string | undefined): number | null => {
  const text = readText(value)
  if (!text) return null

  try {
    const parsed = parseAndConvertSiUnit(text).value
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

const isTypeCConnector = (
  description: string,
  attributes: Record<string, string>,
): boolean => {
  const connectorType = firstAttribute(attributes, [
    "Connector Type",
    "USB Connector Type",
  ])

  if (connectorType) {
    if (NON_TYPE_C_CONNECTOR_PATTERN.test(connectorType)) return false
    if (!TYPE_C_PATTERN.test(connectorType)) return false
    return !NON_TYPE_C_CONNECTOR_PATTERN.test(description)
  }

  if (NON_TYPE_C_CONNECTOR_PATTERN.test(description)) return false
  return TYPE_C_PATTERN.test(description)
}

const isFemaleReceptacle = (
  description: string,
  attributes: Record<string, string>,
): boolean => {
  const gender = firstAttribute(attributes, ["Gender"])

  if (MALE_GENDER_PATTERN.test(description)) return false

  if (gender) {
    if (MALE_GENDER_PATTERN.test(gender)) return false
    if (FEMALE_GENDER_PATTERN.test(gender)) return true
  }

  return FEMALE_GENDER_PATTERN.test(description)
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
      .selectAll("components")
      .where("categories.subcategory", "=", "USB Connectors")
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const attrs = readAttributes(c.extra)
        const description = String(c.description || "")

        if (
          !isTypeCConnector(description, attrs) ||
          !isFemaleReceptacle(description, attrs)
        ) {
          return null
        }

        let tempMin: number | null = null
        let tempMax: number | null = null
        const tempRange = attrs["Operating Temperature Range"]
        if (tempRange?.includes("~")) {
          const [min, max] = tempRange.split("~")
          tempMin = parseNum(min)
          tempMax = parseNum(max)
        }

        const contacts = Number.parseInt(
          (attrs["Number of Contacts"] || "").replace(/[^0-9]/g, ""),
          10,
        )

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description,
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
          package: String(c.package || ""),
          mounting_style: readText(attrs["Mounting Style"]),
          current_rating_a: parseNum(attrs["Current Rating - Power (Max)"]),
          number_of_ports:
            Number.parseInt(attrs["Number of Ports"] || "", 10) || null,
          number_of_contacts: Number.isNaN(contacts) ? null : contacts,
          gender: "Female",
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
