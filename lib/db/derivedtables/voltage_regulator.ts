import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface VoltageRegulator extends BaseComponent {
  package: string
  output_type: "fixed" | "adjustable" | "unknown"
  output_voltage_min: number | null
  output_voltage_max: number | null
  output_current_max: number | null
  dropout_voltage: number | null
  input_voltage_min: number | null
  input_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  quiescent_current: number | null
  power_supply_rejection_db: number | null
  output_noise_uvrms: number | null
  is_low_dropout: boolean
  is_positive: boolean
  topology: string | null
}

export const voltageRegulatorTableSpec: DerivedTableSpec<VoltageRegulator> = {
  tableName: "voltage_regulator",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "output_type", type: "text" },
    { name: "output_voltage_min", type: "real" },
    { name: "output_voltage_max", type: "real" },
    { name: "output_current_max", type: "real" },
    { name: "dropout_voltage", type: "real" },
    { name: "input_voltage_min", type: "real" },
    { name: "input_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "quiescent_current", type: "real" },
    { name: "power_supply_rejection_db", type: "real" },
    { name: "output_noise_uvrms", type: "real" },
    { name: "is_low_dropout", type: "boolean" },
    { name: "is_positive", type: "boolean" },
    { name: "topology", type: "text" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "Linear Voltage Regulators"),
          eb("categories.subcategory", "=", "Linear Voltage Regulators (LDO)"),
          eb("categories.subcategory", "=", "Low Dropout Regulators(LDO)"),
          eb("categories.subcategory", "=", "Dropout Regulators(LDO)"),
        ]),
      ),
  mapToTable: (components) => {
    return components.map((c): VoltageRegulator | null => {
      if (!c.extra) return null
      const extra = JSON.parse(c.extra ?? "{}")
      if (!extra.attributes) return null

      const attrs = extra.attributes
      const desc = c.description.toLowerCase()

      // Parse output type
      let outputType: "fixed" | "adjustable" | "unknown" = "unknown"
      if (attrs["Output Type"]?.toLowerCase().includes("fixed")) {
        outputType = "fixed"
      } else if (attrs["Output Type"]?.toLowerCase().includes("adjustable")) {
        outputType = "adjustable"
      }

      // Parse output voltage range
      let voltageMin = null
      let voltageMax = null
      const rawVoltage = attrs["Output Voltage"]
      if (rawVoltage) {
        const match = rawVoltage.match(/([\d.]+)V~([\d.]+)V/)
        if (match) {
          voltageMin = parseFloat(match[1])
          voltageMax = parseFloat(match[2])
        } else {
          // Single voltage for fixed regulators
          const singleMatch = rawVoltage.match(/([\d.]+)V/)
          if (singleMatch) {
            voltageMin = voltageMax = parseFloat(singleMatch[1])
          }
        }
      }

      // Parse output current
      let outputCurrent = null
      const rawCurrent = attrs["Output Current"]
      if (rawCurrent) {
        const parsed = parseAndConvertSiUnit(rawCurrent).value
        if (parsed) outputCurrent = parsed as number
      }

      // Parse dropout voltage
      let dropoutVoltage = null
      const rawDropout = attrs["Dropout Voltage"]
      if (rawDropout) {
        const match = rawDropout.match(/([\d.]+)V/)
        if (match) dropoutVoltage = parseFloat(match[1])
      }

      // Parse input voltage range
      let inputVoltageMin = null
      let inputVoltageMax = null
      const maxInputVoltage = attrs["Maximum Input Voltage"]
      if (maxInputVoltage) {
        const match = maxInputVoltage.match(/([\d.]+)V/)
        if (match) {
          inputVoltageMax = parseFloat(match[1])
          // Estimate min input as dropout + output for LDOs
          if (dropoutVoltage && voltageMin) {
            inputVoltageMin = voltageMin + dropoutVoltage
          }
        }
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

      // Parse quiescent current
      let quiescentCurrent = null
      const rawQuiescent = attrs["Quiescent Current (Ground Current)"]
      if (rawQuiescent) {
        const parsed = parseAndConvertSiUnit(rawQuiescent).value
        if (parsed) quiescentCurrent = parsed as number
      }

      // Parse power supply rejection ratio
      let psrr = null
      const rawPsrr = attrs["Power Supply Rejection Ratio (PSRR)"]
      if (rawPsrr) {
        const match = rawPsrr.match(/([\d.]+)dB/)
        if (match) psrr = parseFloat(match[1])
      }

      // Parse output noise
      let outputNoise = null
      const rawNoise = attrs["Output Noise"]
      if (rawNoise) {
        const parsed = parseAndConvertSiUnit(rawNoise).value
        if (parsed) outputNoise = (parsed as number) * 1e6 // Convert to μVrms
      }

      // Determine regulator characteristics
      const isLdo = Boolean(
        desc.includes("ldo") ||
          desc.includes("low drop") ||
          desc.includes("low-drop") ||
          (dropoutVoltage && dropoutVoltage < 0.7),
      )

      const isPositive = Boolean(
        attrs["Output Polarity"]?.toLowerCase().includes("positive") ||
          !desc.includes("negative"),
      )

      // Get topology
      const topology = attrs["Topology"] || null

      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        package: c.package || "",
        output_type: outputType,
        output_voltage_min: voltageMin,
        output_voltage_max: voltageMax,
        output_current_max: outputCurrent,
        dropout_voltage: dropoutVoltage,
        input_voltage_min: inputVoltageMin,
        input_voltage_max: inputVoltageMax,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
        quiescent_current: quiescentCurrent,
        power_supply_rejection_db: psrr,
        output_noise_uvrms: outputNoise,
        is_low_dropout: isLdo,
        is_positive: isPositive,
        topology: topology,
        attributes: attrs,
      }
    })
  },
}
