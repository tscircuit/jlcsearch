import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import {
  isLikelyBareBleChip,
  mapBleFields,
  readComponentAttributes,
  type BleComponentFields,
} from "./ble-utils"
import type { DerivedTableSpec } from "./types"

export interface BleModule extends BleComponentFields {
  antenna_type: string | null
}

const inferAntennaType = (
  attributes: Record<string, unknown>,
  description: string,
): string | null => {
  const rawAttr = attributes["Antenna Type"] ?? attributes["Antenna"]
  if (typeof rawAttr === "string" && rawAttr.trim() && rawAttr.trim() !== "-") {
    return rawAttr.trim()
  }
  const match = description.match(
    /\b(On-Board PCB Antenna|PCB Antenna|Chip Antenna|Ceramic Antenna|IPEX(?:\s+interface)?|External Antenna)\b/i,
  )
  return match ? match[1]! : null
}

export const bleModuleTableSpec: DerivedTableSpec<BleModule> = {
  tableName: "ble_module",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "core_processor", type: "text" },
    { name: "bluetooth_version", type: "text" },
    { name: "antenna_type", type: "text" },
    { name: "frequency_ghz", type: "real" },
    { name: "operating_voltage_min", type: "real" },
    { name: "operating_voltage_max", type: "real" },
    { name: "data_rate_mbps", type: "real" },
    { name: "has_uart", type: "boolean" },
    { name: "has_i2c", type: "boolean" },
    { name: "has_spi", type: "boolean" },
    { name: "has_usb", type: "boolean" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "=", "Bluetooth Modules"),
  mapToTable: (components) =>
    components.map((component): BleModule | null => {
      const attributes = readComponentAttributes(component.extra)
      if (!attributes || isLikelyBareBleChip(component)) return null

      return {
        ...mapBleFields(component, attributes),
        price1: extractMinQPrice(component.price),
        antenna_type: inferAntennaType(attributes, component.description ?? ""),
      }
    }),
}
