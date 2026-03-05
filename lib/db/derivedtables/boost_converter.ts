import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface BoostConverter extends BaseComponent {
  package: string
  input_voltage_min: number | null
  input_voltage_max: number | null
  output_voltage_min: number | null
  output_voltage_max: number | null
  output_current_max: number | null
  switching_frequency: number | null
  is_synchronous: boolean | null
  topology: string | null
  number_of_outputs: number | null
}

export const boostConverterTableSpec: DerivedTableSpec<BoostConverter> = {
  tableName: "boost_converter",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "input_voltage_min", type: "real" },
    { name: "input_voltage_max", type: "real" },
    { name: "output_voltage_min", type: "real" },
    { name: "output_voltage_max", type: "real" },
    { name: "output_current_max", type: "real" },
    { name: "switching_frequency", type: "real" },
    { name: "is_synchronous", type: "boolean" },
    { name: "topology", type: "text" },
    { name: "number_of_outputs", type: "integer" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "=", "DC-DC Converters")
      .where((eb) =>
        eb.or([
          eb("description", "like", "%Boost%"),
          eb("description", "like", "%Step-Up%"),
          eb("description", "like", "%step-up%"),
        ]),
      ),
  mapToTable: (components) => {
    const parseVoltageRange = (
      text: string | undefined,
    ): [number | null, number | null] => {
      if (!text) return [null, null]
      const range = text.match(/([\d.]+)V~([\d.]+)V/)
      if (range) return [parseFloat(range[1]), parseFloat(range[2])]
      const single = text.match(/([\d.]+)V/)
      if (single) {
        const v = parseFloat(single[1])
        return [v, v]
      }
      return [null, null]
    }

    return components.map((c) => {
      try {
        const extra = c.extra ? JSON.parse(c.extra) : {}
        const attrs = extra.attributes || {}
        const desc = c.description

        let [inputMin, inputMax] = parseVoltageRange(attrs["Input Voltage"]) // default from attrs
        if (!inputMin && !inputMax) {
          const match = desc.match(/([\d.]+V)~([\d.]+V)/)
          if (match) {
            inputMin = parseFloat(match[1])
            inputMax = parseFloat(match[2])
          }
        }

        const [outputMin, outputMax] = parseVoltageRange(
          attrs["Output Voltage"],
        ) // may be null

        let outputCurrent: number | null = null
        const rawCurrent = attrs["Output Current"]
        if (rawCurrent) {
          const parsed = parseAndConvertSiUnit(rawCurrent).value
          if (parsed) outputCurrent = parsed as number
        } else {
          const m = desc.match(/(\d+(?:\.\d+)?)(?:A|mA)/i)
          if (m) {
            const val = parseFloat(m[1])
            outputCurrent = desc.toLowerCase().includes("ma") ? val / 1000 : val
          }
        }

        let switchingFreq: number | null = null
        const rawFreq = attrs["Switching Frequency"]
        if (rawFreq) {
          const parsed = parseAndConvertSiUnit(rawFreq).value
          if (parsed) switchingFreq = parsed as number
        }

        const isSync = attrs["Synchronous Rectification"]
          ? attrs["Synchronous Rectification"].toLowerCase() === "yes"
          : null

        const topology = attrs["Topology"] || null
        const numOutputs = attrs["Number of Outputs"]
          ? parseInt(attrs["Number of Outputs"]) || null
          : null

        return {
          lcsc: c.lcsc,
          mfr: c.mfr,
          description: c.description,
          stock: c.stock,
          price1: extractMinQPrice(c.price),
          in_stock: c.stock > 0,
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
          is_extended_promotional: Boolean(c.extended_promotional),
          package: c.package || "",
          input_voltage_min: inputMin,
          input_voltage_max: inputMax,
          output_voltage_min: outputMin,
          output_voltage_max: outputMax,
          output_current_max: outputCurrent,
          switching_frequency: switchingFreq,
          is_synchronous: isSync,
          topology,
          number_of_outputs: numOutputs,
          attributes: attrs,
        }
      } catch (e) {
        return null
      }
    })
  },
}
