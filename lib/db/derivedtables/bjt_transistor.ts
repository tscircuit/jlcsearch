import type { DerivedTableSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"
import { BaseComponent } from "./component-base"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"

export interface BJTTransistor extends BaseComponent {
  package?: string
  current_gain?: number
  collector_current?: number
  collector_emitter_voltage?: number
  transition_frequency?: number
  power_dissipation?: number
  temperature_range?: string
}

export const bjtTransistorTableSpec: DerivedTableSpec<BJTTransistor> = {
  tableName: "bjt_transistor",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "current_gain", type: "integer" },
    { name: "collector_current", type: "integer" },
    { name: "collector_emitter_voltage", type: "integer" },
    { name: "transition_frequency", type: "integer" },
    { name: "power_dissipation", type: "integer" },
    { name: "temperature_range", type: "text" },
    { name: "is_basic", type: "boolean" },
{ name: "is_preferred", type: "boolean" },
  ],
  listCandidateComponents(db: KyselyDatabaseInstance) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("description", "like", "%BJT%"),
          eb("description", "like", "%Bipolar Transistor%"),
          eb("description", "like", "%Transistor NPN%"),
          eb("description", "like", "%Transistor PNP%"),
        ]),
      )
  },
  mapToTable(components) {
    return components.map((c) => {
      try {
        const attrs = c.extra ? JSON.parse(c.extra)?.attributes || {} : {}
        const desc = c.description.toLowerCase()

        const parseValue = (val: string | undefined): number | undefined => {
          if (!val) return undefined
          const result = parseAndConvertSiUnit(val)
          return result?.value || undefined
        }

        // Extract values from attributes
        const current_gain = parseValue(attrs["Current Gain (hFE)"])
        const collector_current = parseValue(attrs["Collector Current (Ic)"])
        const collector_emitter_voltage = parseValue(
          attrs["Collector-Emitter Breakdown Voltage (Vceo)"],
        )
        const transition_frequency = parseValue(
          attrs["Transition Frequency (fT)"],
        )
        const power_dissipation = parseValue(attrs["Power Dissipation (Pd)"])
        const temperature_range = attrs["Operating Temperature"] || undefined

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr || ""),
          description: String(c.description || ""),
          stock: Number(c.stock || 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock || 0) > 0),
          is_basic: Boolean(c.basic),
        is_preferred: Boolean(c.basic),
          package: c.package || "",
          current_gain: current_gain,
          collector_current: collector_current,
          collector_emitter_voltage: collector_emitter_voltage,
          transition_frequency: transition_frequency,
          power_dissipation: power_dissipation,
          temperature_range: temperature_range,
          attributes: attrs,
        }
      } catch (e) {
        return null
      }
    })
  },
}
