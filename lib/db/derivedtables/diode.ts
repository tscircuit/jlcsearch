import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"

interface Diode {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  attributes: Record<string, string>

  // Extra columns
  package: string
  forward_voltage: number | null
  reverse_voltage: number | null
  forward_current: number | null
  reverse_leakage_current: number | null
  recovery_time_ns: number | null
  diode_type: string
  is_schottky: boolean
  is_zener: boolean
  is_tvs: boolean
  operating_temp_min: number | null
  operating_temp_max: number | null
  power_dissipation_watts: number | null
  configuration: string | null
}

export const diodeTableSpec: DerivedTableSpec<Diode> = {
  tableName: "diode",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "forward_voltage", type: "real" },
    { name: "reverse_voltage", type: "real" },
    { name: "forward_current", type: "real" },
    { name: "reverse_leakage_current", type: "real" },
    { name: "recovery_time_ns", type: "real" },
    { name: "diode_type", type: "text" },
    { name: "is_schottky", type: "boolean" },
    { name: "is_zener", type: "boolean" },
    { name: "is_tvs", type: "boolean" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "power_dissipation_watts", type: "real" },
    { name: "configuration", type: "text" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "Diodes - General Purpose"),
          eb("categories.subcategory", "=", "Schottky Barrier Diodes (SBD)"),
          eb("categories.subcategory", "=", "Zener Diodes"),
          eb("categories.subcategory", "=", "TVS"),
          eb("categories.subcategory", "=", "Switching Diode"),
          eb(
            "categories.subcategory",
            "=",
            "Fast Recovery / High Efficiency Diodes",
          ),
          eb("categories.subcategory", "=", "Bridge Rectifiers"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): Diode | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse forward voltage
      let forwardVoltage = null
      const rawForwardV =
        attrs["Forward Voltage (Vf@If)"] || attrs["Forward Voltage (Vf)"]
      if (rawForwardV) {
        const match = rawForwardV.match(/([\d.]+)V/)
        if (match) forwardVoltage = parseFloat(match[1])
      }

      // Parse reverse voltage
      let reverseVoltage = null
      const rawReverseV = attrs["Reverse Voltage (Vr)"]
      if (rawReverseV) {
        const parsed = parseAndConvertSiUnit(rawReverseV).value
        if (parsed) reverseVoltage = parsed as number
      }

      // Parse forward current
      let forwardCurrent = null
      const rawForwardI = attrs["Average Rectified Current (Io)"]
      if (rawForwardI) {
        const parsed = parseAndConvertSiUnit(rawForwardI).value
        if (parsed) forwardCurrent = parsed as number
      }

      // Parse reverse leakage current
      let leakageCurrent = null
      const rawLeakage =
        attrs["Reverse Leakage Current"] ||
        attrs["Reverse Leakage Current (Ir)"]
      if (rawLeakage) {
        const parsed = parseAndConvertSiUnit(rawLeakage.split("@")[0]).value
        if (parsed) leakageCurrent = parsed as number
      }

      // Parse recovery time
      let recoveryTime = null
      const rawRecovery = attrs["Reverse Recovery Time (trr)"]
      if (rawRecovery) {
        const match = rawRecovery.match(/(\d+(?:\.\d+)?)ns/)
        if (match) recoveryTime = parseFloat(match[1])
      }

      // Parse temperature range
      let tempMin = null
      let tempMax = null
      const rawTemp = attrs["Operating Temperature"]
      if (rawTemp) {
        const match = rawTemp.match(/([-\d]+)℃~\+([-\d]+)℃/)
        if (match) {
          tempMin = parseInt(match[1])
          tempMax = parseInt(match[2])
        }
      }

      // Parse power dissipation
      let powerDissipation = null
      const rawPower = attrs["Power Dissipation"]
      if (rawPower) {
        const parsed = parseAndConvertSiUnit(rawPower).value
        if (parsed) powerDissipation = parsed as number
      }

      // Determine diode type and characteristics
      const isSchottky = desc.includes("schottky")
      const isZener = desc.includes("zener")
      const isTvs =
        desc.includes("tvs") || desc.includes("transient voltage suppressor")

      let diodeType = "general_purpose"
      if (isSchottky) diodeType = "schottky_barrier"
      else if (isZener) diodeType = "zener"
      else if (isTvs) diodeType = "tvs"
      else if (desc.includes("switching")) diodeType = "switching"
      else if (desc.includes("fast recovery")) diodeType = "fast_recovery"
      else if (desc.includes("bridge")) diodeType = "bridge_rectifier"

      // Get configuration
      const configuration = attrs["Diode Configuration"] || null

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        package: c.package || "",
        forward_voltage: forwardVoltage,
        reverse_voltage: reverseVoltage,
        forward_current: forwardCurrent,
        reverse_leakage_current: leakageCurrent,
        recovery_time_ns: recoveryTime,
        diode_type: diodeType,
        is_schottky: isSchottky,
        is_zener: isZener,
        is_tvs: isTvs,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        power_dissipation_watts: powerDissipation,
        configuration: configuration,
        attributes: attrs,
      }
    })
  },
}
