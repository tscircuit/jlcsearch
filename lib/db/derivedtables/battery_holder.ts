import { parseAndConvertSiUnit } from "lib/util/parse-and-convert-si-unit"
import type { BaseComponent } from "./component-base"
import { createDerivedTableSpec } from "./create-derived-table-spec"

export interface BatteryHolder extends BaseComponent {
  package: string
  connector_type: string | null
  battery_type: string | null
  operating_temp_min: number | null
  operating_temp_max: number | null
}

const BATTERY_CONNECTOR_SUBCATEGORIES = [
  "Battery Connectors",
  "Button And Strip Battery Connector",
  "Blade / Shrapnel Contact Battery Connectors",
  "Blade / Shrapnel Contact Battery Connector",
  "BatteryConnector",
] as const

export const batteryHolderTableSpec = createDerivedTableSpec<BatteryHolder>({
  tableName: "battery_holder",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "connector_type", type: "text" },
    { name: "battery_type", type: "text" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
  ],
  subcategories: BATTERY_CONNECTOR_SUBCATEGORIES,
  mapComponent: (c, attrs) => {
    try {
      const parseTemperature = (value: string | undefined): number | null => {
        if (!value || value === "-") return null
        try {
          return parseAndConvertSiUnit(value.replace("℃", "C")).value as number
        } catch {
          return null
        }
      }

      let tempMin: number | null = null
      let tempMax: number | null = null
      const rawTemp = attrs["Operating Temperature Range"]
      if (rawTemp && rawTemp.includes("~")) {
        const [min, max] = rawTemp.split("~")
        tempMin = parseTemperature(min)
        tempMax = parseTemperature(max)
      }

      return {
        package: String(c.package || ""),
        connector_type: attrs["Connector Type"] || null,
        battery_type: attrs["Battery Type"] || null,
        operating_temp_min: tempMin,
        operating_temp_max: tempMax,
      }
    } catch {
      return null
    }
  },
})
