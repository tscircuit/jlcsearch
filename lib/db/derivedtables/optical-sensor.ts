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
export const OPTICAL_SUBCATEGORIES = [
  ...MOTION_SUBCATEGORIES,
  "Optical Sensors",
  "Photodiodes",
  "Phototransistors",
  "Photoresistors",
  "Image Sensors",
  "Fiber Optic/Laser Sensors",
  "Fiber Optic / Laser Sensors",
  "Photoelectric sensor",
  "Infrared Remote Receiver (IRM)",
  "Color Sensors",
  "UV Sensors",
  "Infrared Sensors",
  "Optical Distance Sensors",
  "Optical Position Sensors",
  "Infrared Temperature Sensors",
  "Thermopiles",
  "PIR Sensors",
  "Optical Encoders",
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
const ADNS_MODELS = [
  "2610",
  "2620",
  "3050",
  "3080",
  "3090",
  "5050",
  "9500",
  "9800",
]
const MOTION_PART_PREFIXES = [
  "PAW3",
  "PMW3",
  "PAN3",
  ...ADNS_MODELS.flatMap((model) => [`ADNS-${model}`, `ADNS${model}`]),
  "PAA5100",
  "PAT9125",
  "PAT9130",
]
const MOTION_PART = new RegExp(
  String.raw`^(?:(?:PAW|PMW|PAN)3\d{3}[A-Z]*|ADNS-?(?:${ADNS_MODELS.join("|")})[A-Z]*|PAA5100[A-Z]*|PAT(?:9125|9130)[A-Z]*)(?:[-/].*)?$`,
  "i",
)
const MOTION_DESCRIPTION =
  /\b(?:optical\s+(?:(?:wireless|gaming|mouse)\s+)*(?:motion|navigation|flow|mouse)|(?:wireless\s+)?optical\s+trackball|trackball\s+(?:mouse\s+)?sensor)\b/i
const OPTICAL_DESCRIPTION =
  /\b(?:optical|photoelectric|infrared|ultraviolet|UV|laser|PIR|pyroelectric|ambient\s+light|color)\s+(?:[a-z-]+\s+)*(?:sensors?|detectors?|receivers?|interrupters?|encoders?)\b|\b(?:photodiodes?|phototransistors?|photoresistors?|photointerrupters?)\b/i
const ACCESSORY_DESCRIPTION =
  /\b(?:lens(?:es)?|accessor(?:y|ies))\s+for\b|\b(?:optical|mouse|sensor)\s+lens(?:es)?\b|\baccessor(?:y|ies)\b/i
export const OTHER_OPTICAL_PART_PREFIXES = [
  "APDS",
  "GP2Y",
  "VL53L",
  "TCS",
  "MLX906",
  "AMG88",
  "PAJ7620",
  "MAX3010",
]
const OTHER_OPTICAL_PART =
  /^(?:APDS-?\d{4}|GP2Y\d[A-Z0-9]*|VL53L\d[A-Z0-9]*|TCS\d{3,5}[A-Z]*|MLX906\d{2}[A-Z0-9]*|AMG88\d{2}|PAJ7620U2|MAX3010[0125][A-Z]*)(?:[-/#+].*)?$/i

export function getOpticalSensorType({
  mfr,
  description,
  subcategory = "",
  category = "",
  attributes = {},
}: {
  mfr: string
  description: string
  subcategory?: string
  category?: string
  attributes?: Record<string, string>
}): string | null {
  if (
    ACCESSORY_DESCRIPTION.test(description) ||
    /accessor|lens/i.test(subcategory)
  )
    return null
  // Only use semantic type attributes; unrelated features such as an optical
  // interface on a non-sensor component must not classify the component.
  const evidence = [
    description,
    attributes["Sensor Type"],
    attributes.Type,
    attributes["Detection Method"],
  ]
    .filter(Boolean)
    .join(" ")
  if (
    MOTION_PART.test(mfr) ||
    MOTION_DESCRIPTION.test(evidence) ||
    MOTION_SUBCATEGORIES.includes(subcategory)
  )
    return "Optical Motion"
  if (OPTICAL_SUBCATEGORIES.includes(subcategory)) return subcategory
  if (
    category === "Optical Sensors" ||
    /^Optical Sensors\s*-/i.test(subcategory)
  )
    return subcategory || "Optical Sensor"
  if (
    OTHER_OPTICAL_PART.test(mfr) ||
    OPTICAL_DESCRIPTION.test(evidence) ||
    /\b(?:optical|infrared|IR|photoelectric|UV|ultraviolet|laser|PIR|pyroelectric|ambient light|color)\b/i.test(
      [
        attributes["Sensor Type"],
        attributes.Type,
        attributes["Detection Method"],
      ]
        .filter(Boolean)
        .join(" "),
    )
  )
    return "Optical Sensor"
  return null
}

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
      .select([
        "categories.subcategory as source_subcategory",
        "categories.category as source_category",
      ])
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "in", [
            ...OPTICAL_SUBCATEGORIES,
            "Specialized Sensors",
            "Proximity Sensors",
            "Sensor Modules",
            "Temperature Sensors",
            "Human Body Sensing Sensor",
            "Position Sensors",
            "Rotary Encoders",
            "Encoder",
          ]),
          eb("categories.category", "=", "Optical Sensors"),
          eb("categories.subcategory", "like", "Optical Sensors%"),
          ...[
            "optical",
            "laser",
            "photo",
            "infrared",
            "ultraviolet",
            "ambient light",
            "color sensor",
            "time-of-flight",
          ].map((word) => eb("components.description", "like", `%${word}%`)),
          eb("components.description", "like", "%trackball%sensor%"),
          ...[...MOTION_PART_PREFIXES, ...OTHER_OPTICAL_PART_PREFIXES].map(
            (prefix) => eb("components.mfr", "like", `${prefix}%`),
          ),
        ]),
      ),
  mapToTable: (components) =>
    components.map((component) => {
      const mfr = String(component.mfr ?? "")
      const description = String(component.description ?? "")
      const source = component as typeof component & {
        source_subcategory?: string | null
        source_category?: string | null
      }
      let extra: { package?: string; attributes?: Record<string, string> } = {}
      try {
        extra = component.extra ? (JSON.parse(component.extra) ?? {}) : {}
      } catch {
        // Optional metadata must not hide known optical sensors.
      }
      const sensorType = getOpticalSensorType({
        mfr,
        description,
        subcategory: source.source_subcategory ?? "",
        category: source.source_category ?? "",
        attributes: extra.attributes ?? {},
      })
      if (!sensorType) return null
      return {
        lcsc: Number(component.lcsc),
        mfr,
        description,
        package: String(extra.package ?? component.package ?? ""),
        sensor_type: sensorType,
        stock: Number(component.stock ?? 0),
        price1: extractMinQPrice(component.price),
        in_stock: Number(component.stock ?? 0) > 0,
        is_basic: Boolean(component.basic),
        is_preferred: Boolean(component.preferred),
        attributes: extra.attributes ?? {},
      }
    }),
}
