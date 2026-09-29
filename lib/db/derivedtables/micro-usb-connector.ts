import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface MicroUsbConnector extends BaseComponent {
  package: string
  connector_type: string | null
  usb_standard: string | null
  mounting_style: string | null
  current_rating_a: number | null
  number_of_ports: number | null
  number_of_contacts: number | null
  gender: string | null
  operating_temp_min: number | null
  operating_temp_max: number | null
}

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

const parseCount = (value: string | null): number | null => {
  const match = value?.match(/\d+/)
  if (!match) return null

  const parsed = Number.parseInt(match[0], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const parseAmps = (value: string | null): number | null => {
  if (!value) return null

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

  return { min: Number(match[1]), max: Number(match[2]) }
}

const isMicroUsbConnector = (
  component: { mfr: string; description: string; package: string },
  attributes: Record<string, string>,
): boolean => {
  const searchableText = [
    component.mfr,
    component.description,
    component.package,
    ...Object.values(attributes),
  ]
    .filter(Boolean)
    .join(" ")

  if (/\bmini[\s_-]*usb\b|\busb[\s_-]*mini\b/i.test(searchableText)) {
    return false
  }
  if (
    /\btype[\s_-]*c\b|\busb[\s_-]*c\b|\btype[\s_-]*c\d*\b/i.test(searchableText)
  ) {
    return false
  }

  return /micro/i.test(searchableText)
}

export const microUsbConnectorTableSpec: DerivedTableSpec<MicroUsbConnector> = {
  tableName: "micro_usb_connector",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "connector_type", type: "text" },
    { name: "usb_standard", type: "text" },
    { name: "mounting_style", type: "text" },
    { name: "current_rating_a", type: "real" },
    { name: "number_of_ports", type: "integer" },
    { name: "number_of_contacts", type: "integer" },
    { name: "gender", type: "text" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  indexes: [
    { name: "idx_micro_usb_connector_stock", columns: ["stock"] },
    {
      name: "idx_micro_usb_connector_package_stock",
      columns: ["package", "stock"],
    },
    {
      name: "idx_micro_usb_connector_connector_type_stock",
      columns: ["connector_type", "stock"],
    },
    {
      name: "idx_micro_usb_connector_mounting_style_stock",
      columns: ["mounting_style", "stock"],
    },
    {
      name: "idx_micro_usb_connector_number_of_contacts_stock",
      columns: ["number_of_contacts", "stock"],
    },
    {
      name: "idx_micro_usb_connector_gender_stock",
      columns: ["gender", "stock"],
    },
    {
      name: "idx_micro_usb_connector_is_basic_stock",
      columns: ["is_basic", "stock"],
    },
    {
      name: "idx_micro_usb_connector_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll("components")
      .where("categories.subcategory", "=", "USB Connectors"),
  mapToTable: (components) =>
    components.map((component): MicroUsbConnector | null => {
      const attributes = readAttributes(component.extra)
      const base = {
        mfr: String(component.mfr || ""),
        description: String(component.description || ""),
        package: String(component.package || ""),
      }

      if (!isMicroUsbConnector(base, attributes)) return null

      const connectorType = firstAttribute(attributes, [
        "Connector Type",
        "USB Connector Type",
        "Product Type",
      ])
      const operatingTemperature = parseOperatingTemperature(
        firstAttribute(attributes, [
          "Operating Temperature Range",
          "Operating Temperature",
        ]),
      )

      return {
        lcsc: Number(component.lcsc),
        ...base,
        stock: Number(component.stock || 0),
        price1: extractMinQPrice(component.price),
        in_stock: Number(component.stock || 0) > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        is_extended_promotional: Boolean(component.is_extended_promotional),
        connector_type: connectorType || "Micro USB",
        usb_standard: firstAttribute(attributes, [
          "USB Standard",
          "USB Version",
          "Specifications",
        ]),
        mounting_style: firstAttribute(attributes, [
          "Mounting Style",
          "Mounting Type",
        ]),
        current_rating_a: parseAmps(
          firstAttribute(attributes, [
            "Current Rating - Power (Max)",
            "Current Rating",
            "Current Rating (Amps)",
          ]),
        ),
        number_of_ports: parseCount(attributes["Number of Ports"] || null),
        number_of_contacts: parseCount(
          firstAttribute(attributes, [
            "Number of Contacts",
            "Number of Positions",
          ]),
        ),
        gender: firstAttribute(attributes, ["Gender"]),
        operating_temp_min: operatingTemperature.min,
        operating_temp_max: operatingTemperature.max,
        attributes,
      }
    }),
}
