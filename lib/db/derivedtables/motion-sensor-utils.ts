import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"

export const MOTION_SENSOR_SUBCATEGORIES = [
  "Motion Sensors - Accelerometers",
  "Accelerometers",
  "Motion Sensors - Gyroscopes",
  "Gyroscopes",
  "Motion Sensors - IMUs (Inertial Measurement Units)",
  "Inertial Measurement Units (IMUs)",
  "Attitude Sensors",
  "Attitude Sensor/Gyroscope",
  "Angular Velocity Sensors",
] as const

const ACCELEROMETER_DEFAULT_SUBCATEGORIES = new Set<string>([
  "Motion Sensors - Accelerometers",
  "Accelerometers",
  "Motion Sensors - IMUs (Inertial Measurement Units)",
  "Inertial Measurement Units (IMUs)",
])

const GYROSCOPE_DEFAULT_SUBCATEGORIES = new Set<string>([
  "Motion Sensors - Gyroscopes",
  "Gyroscopes",
  "Motion Sensors - IMUs (Inertial Measurement Units)",
  "Inertial Measurement Units (IMUs)",
  "Attitude Sensors",
  "Attitude Sensor/Gyroscope",
  "Angular Velocity Sensors",
])

const GYRO_ONLY_MFR_RE =
  /^(?:L3G|I3G|ITG-?3|ICG-?[123]|BMG\d|IAM-?203|ADXRS|ENC-?03)/i

const IMU_MFR_RE =
  /^(?:MPU-?[69]\d{3}|LSM6DS|LSM9DS|BMI(?:055|085|088|160|270|323)|ICM-?(?:206|209|406|426|456)|QMI86|ASM330|ISM330)/i

const ACCEL_ONLY_MFR_RE =
  /^(?:ADXL\d|LIS[23]|MMA\d|BMA\d|KX[T0-9]|MC3[46]\d|STK8\d|SC7A\d|QMA\d|MXC\d|DA2\d)/i

const GYRO_SENSOR_TYPE_RE =
  /gyro|imu|inertial|angular\s*velocity|6-axis|6\s*axis|9-axis|9\s*axis|陀螺仪/i

const ACCEL_SENSOR_TYPE_RE =
  /accel|imu|inertial|6-axis|6\s*axis|9-axis|9\s*axis|加速度/i

const GYRO_DESC_RE =
  /gyro|\bimu\b|inertial\s*measurement|angular\s*velocity|(?:±|\+-|\b)\d+(?:\.\d+)?\s*(?:dps|deg\/s|°\/s)\b|陀螺仪/i

const ACCEL_DESC_RE =
  /\baccel(?:erometer|erator)s?\b|\bimu\b|inertial\s*measurement|(?:±|\+-)\s*\d+(?:\.\d+)?\s*g\b|加速度/i

export interface MotionSensorComponent extends BaseComponent {
  package: string
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  axes: string | null
  has_i2c: boolean
  has_spi: boolean
  has_uart: boolean
}

type RawComponentRow = {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price: string | null
  basic?: number | boolean | null
  preferred?: number | boolean | null
  package?: string | null
  extra?: string | null
  source_subcategory?: string | null
}

const IGNORED_ATTR_VALUES = new Set(["", "-", "--", "null", "n/a", "none"])

export const readMotionSensorAttributes = (
  rawExtra: string | null | undefined,
): Record<string, string> => {
  if (!rawExtra) return {}
  try {
    const parsed = JSON.parse(rawExtra)
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.attributes ||
      typeof parsed.attributes !== "object"
    ) {
      return {}
    }
    const attrs: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed.attributes)) {
      if (typeof value === "string") {
        attrs[key] = value
      } else if (typeof value === "number") {
        attrs[key] = String(value)
      }
    }
    return attrs
  } catch {
    return {}
  }
}

const getCleanAttr = (
  attrs: Record<string, string>,
  keys: readonly string[],
): string | null => {
  for (const key of keys) {
    const raw = attrs[key]?.trim()
    if (!raw) continue
    if (IGNORED_ATTR_VALUES.has(raw.toLowerCase())) continue
    return raw
  }
  return null
}

const stripConditionSuffix = (raw: string): string =>
  raw.replace(/@.*$/, "").trim()

const toVolts = (value: number, unit?: string): number => {
  if (unit?.toLowerCase() === "mv") return value / 1000
  return value
}

export const parseSupplyVoltageRange = (
  attrs: Record<string, string>,
  description: string,
): { min: number | null; max: number | null } => {
  const rawVoltage = getCleanAttr(attrs, [
    "Supply Voltage",
    "Voltage - Supply",
    "Operating Supply Voltage",
    "Supply Voltage - Min/Max",
  ])

  if (rawVoltage) {
    const cleaned = stripConditionSuffix(rawVoltage)
    const rangeMatch = cleaned.match(
      /([\d.]+)\s*(m?V)?\s*(?:~|～|to|–|-)\s*([\d.]+)\s*(m?V)/i,
    )
    if (rangeMatch) {
      const endUnit = rangeMatch[4]
      const startUnit = rangeMatch[2] || endUnit
      const v1 = toVolts(parseFloat(rangeMatch[1]!), startUnit)
      const v2 = toVolts(parseFloat(rangeMatch[3]!), endUnit)
      if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
        return { min: Math.min(v1, v2), max: Math.max(v1, v2) }
      }
    }

    const singleMatch = cleaned.match(/([\d.]+)\s*(m?V)\b/i)
    if (singleMatch) {
      const v = toVolts(parseFloat(singleMatch[1]!), singleMatch[2])
      if (!Number.isNaN(v)) {
        return { min: v, max: v }
      }
    }
  }

  const descRangeMatch = description.match(
    /(?<![\w.])([\d.]+)\s*(m?V)\s*(?:~|～)\s*([\d.]+)\s*(m?V)\b/i,
  )
  if (descRangeMatch) {
    const v1 = toVolts(parseFloat(descRangeMatch[1]!), descRangeMatch[2])
    const v2 = toVolts(parseFloat(descRangeMatch[3]!), descRangeMatch[4])
    if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
      return { min: Math.min(v1, v2), max: Math.max(v1, v2) }
    }
  }

  return { min: null, max: null }
}

export const parseOperatingTempRange = (
  attrs: Record<string, string>,
  description: string,
): { min: number | null; max: number | null } => {
  const rawTemp = getCleanAttr(attrs, [
    "Operating Temperature",
    "Operating temperature",
  ])
  const candidates = [
    rawTemp ? stripConditionSuffix(rawTemp) : null,
    description,
  ]

  for (const source of candidates) {
    if (!source) continue
    const match = source.match(
      /(-?\d+(?:\.\d+)?)\s*(?:℃|°C)\s*(?:~|～|to|–|-)\s*\+?(-?\d+(?:\.\d+)?)\s*(?:℃|°C)/i,
    )
    if (match) {
      const t1 = parseFloat(match[1]!)
      const t2 = parseFloat(match[2]!)
      if (!Number.isNaN(t1) && !Number.isNaN(t2)) {
        return { min: Math.min(t1, t2), max: Math.max(t1, t2) }
      }
    }
  }

  return { min: null, max: null }
}

const normalizeAxesValue = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed || IGNORED_ATTR_VALUES.has(trimmed.toLowerCase())) return null

  if (/^(?:x\s*[,/]\s*y\s*[,/]\s*z|xyz|3\s*-?\s*axis)$/i.test(trimmed)) {
    return "X,Y,Z"
  }
  if (/^[xyz](?:\s*[,/]\s*[xyz])*$/i.test(trimmed)) {
    const uniqueAxes = Array.from(
      new Set(
        trimmed
          .toUpperCase()
          .split(/[,/\s]+/)
          .filter((token) => token === "X" || token === "Y" || token === "Z"),
      ),
    )
    if (uniqueAxes.length > 0) return uniqueAxes.join(",")
  }

  return trimmed
}

export const parseMotionSensorAxes = (
  attrs: Record<string, string>,
  description: string,
  kind: "accelerometer" | "gyroscope",
): string | null => {
  const priorityKeys =
    kind === "accelerometer"
      ? [
          "Accelerometer Sensing Axis",
          "Axial Direction",
          "Sensing Axis",
          "Axes",
          "Axis",
        ]
      : [
          "Gyroscope Sensing Axis",
          "Axial Direction",
          "Sensing Axis",
          "Axes",
          "Axis",
        ]

  const rawAxes = getCleanAttr(attrs, priorityKeys)
  if (rawAxes) {
    return normalizeAxesValue(rawAxes)
  }

  const descAxesMatch = description.match(
    /\b([XYZ](?:\s*,\s*[XYZ])+|\b3-?axis)\b/i,
  )
  if (descAxesMatch) {
    return normalizeAxesValue(descAxesMatch[1]!)
  }

  return null
}

export const isGyroscopeComponent = (
  component: RawComponentRow,
  attrs: Record<string, string>,
): boolean => {
  const sensorType = getCleanAttr(attrs, ["Sensor Type", "Type"]) ?? ""
  const mfr = (component.mfr ?? "").trim()
  const description = component.description ?? ""

  const hasGyroAttr = Boolean(
    getCleanAttr(attrs, [
      "Gyroscope Measurement Range (MAX)",
      "Gyroscope Range",
      "Angular Velocity Range",
      "Gyroscope Sensing Axis",
    ]),
  )

  if (
    hasGyroAttr ||
    GYRO_SENSOR_TYPE_RE.test(sensorType) ||
    GYRO_DESC_RE.test(description) ||
    GYRO_ONLY_MFR_RE.test(mfr) ||
    IMU_MFR_RE.test(mfr)
  ) {
    return true
  }

  const hasAccelOnlySignal =
    Boolean(
      getCleanAttr(attrs, [
        "Acceleration Measurement Range (MAX)",
        "Acceleration Range",
        "Accelerometer Sensing Axis",
      ]),
    ) ||
    ACCEL_SENSOR_TYPE_RE.test(sensorType) ||
    ACCEL_ONLY_MFR_RE.test(mfr) ||
    ACCEL_DESC_RE.test(description)

  if (hasAccelOnlySignal) {
    return false
  }

  const subcat = (component.source_subcategory ?? "").trim()
  return !subcat || GYROSCOPE_DEFAULT_SUBCATEGORIES.has(subcat)
}

export const isAccelerometerComponent = (
  component: RawComponentRow,
  attrs: Record<string, string>,
): boolean => {
  const sensorType = getCleanAttr(attrs, ["Sensor Type", "Type"]) ?? ""
  const mfr = (component.mfr ?? "").trim()
  const description = component.description ?? ""

  const hasAccelAttr = Boolean(
    getCleanAttr(attrs, [
      "Acceleration Measurement Range (MAX)",
      "Acceleration Range",
      "Accelerometer Sensing Axis",
    ]),
  )

  const isExplicitGyroOnly =
    GYRO_ONLY_MFR_RE.test(mfr) ||
    (Boolean(sensorType) &&
      GYRO_SENSOR_TYPE_RE.test(sensorType) &&
      !ACCEL_SENSOR_TYPE_RE.test(sensorType) &&
      !hasAccelAttr)

  if (isExplicitGyroOnly) {
    return false
  }

  if (
    hasAccelAttr ||
    ACCEL_SENSOR_TYPE_RE.test(sensorType) ||
    IMU_MFR_RE.test(mfr) ||
    ACCEL_ONLY_MFR_RE.test(mfr) ||
    ACCEL_DESC_RE.test(description)
  ) {
    return true
  }

  if (GYRO_DESC_RE.test(description)) {
    return false
  }

  const subcat = (component.source_subcategory ?? "").trim()
  return !subcat || ACCELEROMETER_DEFAULT_SUBCATEGORIES.has(subcat)
}

export const mapMotionSensorFields = (
  component: RawComponentRow,
  attrs: Record<string, string>,
  kind: "accelerometer" | "gyroscope",
): MotionSensorComponent => {
  const description = component.description ?? ""
  const descLower = description.toLowerCase()
  const voltage = parseSupplyVoltageRange(attrs, description)
  const temp = parseOperatingTempRange(attrs, description)
  const axes = parseMotionSensorAxes(attrs, description, kind)

  const interfaceStr = [
    getCleanAttr(attrs, [
      "Interface Type",
      "Interface",
      "Output Type",
      "Communication Interface",
    ]) ?? "",
    descLower,
  ]
    .join(" ")
    .toLowerCase()

  const hasI2c =
    interfaceStr.includes("i2c") ||
    interfaceStr.includes("i²c") ||
    interfaceStr.includes("iic")
  const hasSpi = interfaceStr.includes("spi")
  const hasUart =
    interfaceStr.includes("uart") || interfaceStr.includes("usart")

  return {
    lcsc: component.lcsc,
    mfr: component.mfr,
    description,
    stock: component.stock,
    price1: extractMinQPrice(component.price ?? ""),
    in_stock: component.stock > 0,
    is_basic: Boolean(component.basic),
    is_preferred: Boolean(component.preferred),
    package: component.package || "",
    supply_voltage_min: voltage.min,
    supply_voltage_max: voltage.max,
    operating_temp_min: temp.min,
    operating_temp_max: temp.max,
    axes,
    has_i2c: hasI2c,
    has_spi: hasSpi,
    has_uart: hasUart,
    attributes: attrs,
  }
}
