import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface OpticalSensor extends BaseComponent {
  package: string
  sensor_type: string
}

const MOTION_SUBCATEGORIES = [
  "Optical Motion Sensors",
  "Optical Navigation Sensors",
  "Optical Mouse Sensors",
  "Mouse Sensors",
]
const OPTICAL_SUBCATEGORIES = [
  ...MOTION_SUBCATEGORIES,
  "Optical Sensors",
  "Ambient Light Sensors",
  "Ambient Light, IR, UV Sensors",
  "Reflective Optical Interrupters",
  "Photointerrupters - Slot Type - Transistor Output",
  "Photointerrupters - Slot Type - Logic Output",
]

// Navigation ICs can be filed under Specialized Sensors, Image Sensors, or
// Ambient Light Sensors. Match the part family even when metadata is absent.
// PMW3360: https://www.lcsc.com/product-detail/C20612443.html
// PAW3220: https://www.pixart.com/products-detail/19/PAW3220LU-TJDU
const MOTION_PART_PREFIXES = [
  "PAW3",
  "PMW3",
  "PAN3",
  "ADNS-9500",
  "ADNS-9800",
  "ADNS9500",
  "ADNS9800",
  "PAT9125",
  "PAT9130",
]
const MOTION_PART =
  /^(?:(?:PAW|PMW|PAN)3\d{3}[A-Z]*|ADNS-?(?:9500|9800)[A-Z]*|PAT(?:9125|9130)[A-Z]*)(?:[-/].*)?$/i
const MOTION_DESCRIPTION =
  /\b(?:optical\s+(?:(?:wireless|gaming|mouse)\s+)*(?:motion|navigation|flow|mouse)|(?:wireless\s+)?optical\s+trackball|trackball\s+(?:mouse\s+)?sensor)\b/i
const OPTICAL_DESCRIPTION = /\boptical\s+(?:sensors?|interrupters?)\b/i
const ACCESSORY_DESCRIPTION =
  /\b(?:lens(?:es)?|accessor(?:y|ies))\s+for\b|\b(?:optical|mouse|sensor)\s+lens(?:es)?\b|\baccessor(?:y|ies)\b/i

export const opticalSensorTableSpec: DerivedTableSpec<OpticalSensor> = {
  tableName: "optical_sensor",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "sensor_type", type: "text" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  indexes: [
    { name: "idx_optical_sensor_stock", columns: ["stock"] },
    { name: "idx_optical_sensor_package_stock", columns: ["package", "stock"] },
    {
      name: "idx_optical_sensor_type_stock",
      columns: ["sensor_type", "stock"],
    },
    {
      name: "idx_optical_sensor_is_basic_stock",
      columns: ["is_basic", "stock"],
    },
    {
      name: "idx_optical_sensor_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .leftJoin("categories", "components.category_id", "categories.id")
      .selectAll("components")
      .select("categories.subcategory as source_subcategory")
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "in", OPTICAL_SUBCATEGORIES),
          eb("components.description", "like", "%optical%"),
          eb("components.description", "like", "%trackball%sensor%"),
          ...MOTION_PART_PREFIXES.map((prefix) =>
            eb("components.mfr", "like", `${prefix}%`),
          ),
        ]),
      ),
  mapToTable: (components) =>
    components.map((component) => {
      const mfr = String(component.mfr ?? "")
      const description = String(component.description ?? "")
      const subcategory = (
        component as typeof component & { source_subcategory?: string | null }
      ).source_subcategory
      const isMotion =
        MOTION_PART.test(mfr) ||
        MOTION_DESCRIPTION.test(description) ||
        MOTION_SUBCATEGORIES.includes(subcategory ?? "")
      if (
        (!isMotion &&
          !OPTICAL_SUBCATEGORIES.includes(subcategory ?? "") &&
          !OPTICAL_DESCRIPTION.test(description)) ||
        ACCESSORY_DESCRIPTION.test(description)
      ) {
        return null
      }

      let extra: { package?: string; attributes?: Record<string, string> } = {}
      try {
        extra = component.extra ? (JSON.parse(component.extra) ?? {}) : {}
      } catch {
        // Optional metadata must not hide known optical sensors.
      }
      return {
        lcsc: Number(component.lcsc),
        mfr,
        description,
        package: String(extra.package ?? component.package ?? ""),
        sensor_type: isMotion
          ? "Optical Motion"
          : OPTICAL_SUBCATEGORIES.includes(subcategory ?? "")
            ? subcategory!
            : "Optical Sensor",
        stock: Number(component.stock ?? 0),
        price1: extractMinQPrice(component.price),
        in_stock: Number(component.stock ?? 0) > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        attributes: extra.attributes ?? {},
      }
    }),
}
