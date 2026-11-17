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

const TYPE_C_PATTERN = /(?:^|[^a-z0-9])(?:usb|type)[\s_-]*c(?![a-z])/i
const NON_TYPE_C_PATTERN =
  /(?:^|[^a-z0-9])(?:type[\s_-]*(?:a|b)|usb[\s_-]*(?:a|b)|micro[\s_-]*(?:usb|a|b|ab)|mini[\s_-]*(?:usb|a|b|ab)|usb[\s_-]*(?:micro|mini)|lightning)(?![a-z])/i
const FEMALE_GENDER_PATTERN =
  /(?:^|[^a-z])(?:female|mother|receptacle|socket)(?![a-z])|母座|母头|^母$/i
const NON_FEMALE_GENDER_PATTERN =
  /(?:^|[^a-z])(?:male|public|adapter|cable)(?![a-z])|(?:^|[^a-z])plug(?![-\s]in\b|[a-z])|公头|公座|公端|插头/i

const readExtra = (
  extraJson: string | null,
): { attributes: Record<string, string>; title: string | null } => {
  if (!extraJson) return { attributes: {}, title: null }

  try {
    const parsed = JSON.parse(extraJson)
    const attributes =
      parsed?.attributes && typeof parsed.attributes === "object"
        ? (parsed.attributes as Record<string, string>)
        : {}
    const title = typeof parsed?.title === "string" ? parsed.title : null
    return { attributes, title }
  } catch {
    return { attributes: {}, title: null }
  }
}

const readText = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized && normalized !== "-" ? normalized : null
}

const firstAttribute = (
  attributes: Record<string, unknown>,
  names: string[],
): string | null => {
  for (const name of names) {
    const value = readText(attributes[name])
    if (value) return value
  }
  return null
}

const parseCount = (value: string | null): number | null => {
  const match = value?.match(/\d+/)
  if (!match) return null

  const parsed = Number.parseInt(match[0], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const parseAmps = (value: string | null): number | null => {
  if (!value) return null

  const matches = value.match(/\d+(?:\.\d+)?\s*(?:µA|uA|mA|ma|A|kA|MA)\b/gi)
  if (matches && matches.length > 0) {
    const parsedValues = matches
      .map((token) => {
        try {
          const parsed = parseAndConvertSiUnit(token.replace(/\s+/g, "")).value
          return typeof parsed === "number" && Number.isFinite(parsed)
            ? parsed
            : null
        } catch {
          return null
        }
      })
      .filter((parsed): parsed is number => parsed !== null)

    if (parsedValues.length > 0) {
      return Math.max(...parsedValues)
    }
  }

  try {
    const parsed = parseAndConvertSiUnit(value).value
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

const parseOperatingTemperature = (
  value: string | null,
): { min: number | null; max: number | null } => {
  const match = value?.match(
    /(-?\d+(?:\.\d+)?)\s*(?:℃|°C)?\s*(?:~|to)\s*\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)?/i,
  )
  if (!match) return { min: null, max: null }

  const min = Number(match[1])
  const max = Number(match[2])
  return {
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
  }
}

const inferNumberOfContacts = (
  attributes: Record<string, unknown>,
  description: string,
): number | null =>
  parseCount(
    firstAttribute(attributes, ["Number of Contacts", "Number of Pins"]),
  ) ?? parseCount(description.match(/\b(\d+)\s*P\b/i)?.[1] ?? null)

const isUsbCReceptacle = (
  component: { mfr: string; description: string; package: string },
  attributes: Record<string, unknown>,
  title: string | null,
): boolean => {
  const connectorType = firstAttribute(attributes, [
    "Connector Type",
    "USB Connector Type",
  ])
  if (
    connectorType &&
    (!TYPE_C_PATTERN.test(connectorType) ||
      NON_TYPE_C_PATTERN.test(connectorType))
  ) {
    return false
  }

  const typeSearchText = [
    component.mfr,
    component.description,
    component.package,
    title,
    connectorType,
  ]
    .filter(Boolean)
    .join(" ")

  if (
    !TYPE_C_PATTERN.test(typeSearchText) ||
    NON_TYPE_C_PATTERN.test(typeSearchText)
  ) {
    return false
  }

  const genderAttr = firstAttribute(attributes, ["Gender"])
  if (
    genderAttr &&
    (!FEMALE_GENDER_PATTERN.test(genderAttr) ||
      NON_FEMALE_GENDER_PATTERN.test(genderAttr))
  ) {
    return false
  }

  // Strip JLCPCB's "Vertical/Horizontal plug" mounting translation so
  // through-hole receptacles are not misclassified as male plugs.
  const genderSearchText = [
    component.description,
    title,
    component.mfr,
    connectorType,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\b(?:vertical|horizontal)\s+plug\b/gi, " ")

  if (NON_FEMALE_GENDER_PATTERN.test(genderSearchText)) {
    return false
  }

  return Boolean(genderAttr || FEMALE_GENDER_PATTERN.test(genderSearchText))
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
    return components.map((c): UsbCConnector | null => {
      const { attributes, title } = readExtra(c.extra)
      const base = {
        mfr: String(c.mfr || ""),
        description: String(c.description || ""),
        package: String(c.package || ""),
      }

      if (!isUsbCReceptacle(base, attributes, title)) {
        return null
      }

      const operatingTemperature = parseOperatingTemperature(
        firstAttribute(attributes, [
          "Operating Temperature Range",
          "Operating Temperature",
        ]),
      )

      return {
        lcsc: Number(c.lcsc),
        ...base,
        stock: Number(c.stock || 0),
        price1: c.price ? extractMinQPrice(c.price) : null,
        in_stock: Number(c.stock || 0) > 0,
        is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.preferred),
        mounting_style: firstAttribute(attributes, [
          "Mounting Style",
          "Mounting Type",
        ]),
        current_rating_a: parseAmps(
          firstAttribute(attributes, [
            "Current Rating - Power (Max)",
            "Current Rating-Power",
            "Current Rating",
            "Current Rating (Amps)",
          ]),
        ),
        number_of_ports: parseCount(
          firstAttribute(attributes, ["Number of Ports"]),
        ),
        number_of_contacts: inferNumberOfContacts(attributes, base.description),
        gender: "Female",
        operating_temp_min: operatingTemperature.min,
        operating_temp_max: operatingTemperature.max,
        attributes,
      }
    })
  },
}
