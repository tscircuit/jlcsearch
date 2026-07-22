import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import {
  BLE_CHIP_MFR_PATTERNS,
  BLE_CHIP_SUBCATEGORIES,
  isBleChip,
  isLikelyBareBleChip,
  mapBleFields,
  readComponentAttributes,
  type BleComponentFields,
} from "./ble-utils"
import type { DerivedTableSpec } from "./types"

export type BleChip = BleComponentFields

export const bleChipTableSpec: DerivedTableSpec<BleChip> = {
  tableName: "ble_chip",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "core_processor", type: "text" },
    { name: "bluetooth_version", type: "text" },
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
      .selectAll("components")
      .select(["categories.subcategory as source_subcategory"])
      .where("categories.subcategory", "in", [...BLE_CHIP_SUBCATEGORIES])
      .where((eb) =>
        eb.or([
          eb("components.extra", "like", "%Bluetooth%"),
          eb("components.description", "like", "%Bluetooth%"),
          ...BLE_CHIP_MFR_PATTERNS.map((pattern) =>
            eb("components.mfr", "like", pattern),
          ),
        ]),
      ),
  mapToTable: (components) =>
    components.map((component): BleChip | null => {
      const attributes = readComponentAttributes(component.extra)
      if (!attributes || !isBleChip(component, attributes)) return null

      const sourceSubcategory = (
        component as typeof component & {
          source_subcategory?: string | null
        }
      ).source_subcategory
      if (
        sourceSubcategory === "Bluetooth Modules" &&
        !isLikelyBareBleChip(component)
      ) {
        return null
      }

      return {
        ...mapBleFields(component, attributes),
        price1: extractMinQPrice(component.price),
      }
    }),
}
