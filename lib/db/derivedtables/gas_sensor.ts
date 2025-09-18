import type { DerivedTableSpec } from "./types"
import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import { BaseComponent } from "./component-base"

export interface GasSensor extends BaseComponent {
  package: string
  sensor_type: string | null
  measures_air_quality: boolean
  measures_co2: boolean
  measures_oxygen: boolean
  measures_carbon_monoxide: boolean
  measures_methane: boolean
  measures_nitrogen_oxides: boolean
  measures_sulfur_hexafluoride: boolean
  measures_volatile_organic_compounds: boolean
  measures_formaldehyde: boolean
  measures_hydrogen: boolean
  measures_explosive_gases: boolean
}

export const gasSensorTableSpec: DerivedTableSpec<GasSensor> = {
  tableName: "gas_sensor",
  extraColumns: [
    { name: "kicad_footprint", type: "text" },
    { name: "jlc_part_number", type: "text" },
    { name: "package", type: "text" },
    { name: "sensor_type", type: "text" },
    { name: "measures_air_quality", type: "boolean" },
    { name: "measures_co2", type: "boolean" },
    { name: "measures_oxygen", type: "boolean" },
    { name: "measures_carbon_monoxide", type: "boolean" },
    { name: "measures_methane", type: "boolean" },
    { name: "measures_nitrogen_oxides", type: "boolean" },
    { name: "measures_sulfur_hexafluoride", type: "boolean" },
    { name: "measures_volatile_organic_compounds", type: "boolean" },
    { name: "measures_formaldehyde", type: "boolean" },
    { name: "measures_hydrogen", type: "boolean" },
    { name: "measures_explosive_gases", type: "boolean" },
  ],
  listCandidateComponents(db) {
    return db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where("categories.subcategory", "=", "Gas Sensors")
  },
  mapToTable(components) {
    return components.map((c) => {
      const desc = (c.description || "").toLowerCase()
      const name = (c.mfr || "").toLowerCase()

      const measuresAirQuality =
        desc.includes("air quality") ||
        desc.includes("\u7a7a\u6c14\u8d28\u91cf")
      const measuresCo2 = desc.includes("co2")
      const measuresOxygen = desc.includes("oxygen")
      const measuresCarbonMonoxide = desc.includes("carbon monoxide")
      const measuresMethane = desc.includes("methane")
      const measuresNitrogenOxides = desc.includes("nitrogen oxide")
      const measuresSulfurHexafluoride =
        desc.includes("sulfur hexafluoride") || name.includes("sf6")
      const measuresVOC =
        desc.includes("volatile") ||
        desc.includes("voc") ||
        desc.includes("\u6325\u53d1")
      const measuresFormaldehyde =
        name.includes("ch2o") ||
        desc.includes("ch2o") ||
        desc.includes("formaldehyde")
      const measuresHydrogen = name.endsWith("-h2") || desc.includes("hydrogen")
      const measuresExplosive = desc.includes("explosive")

      const sensorType = measuresAirQuality
        ? "Air Quality Sensor"
        : "Gas Sensor"
      return {
        lcsc: c.lcsc,
        mfr: c.mfr,
        description: c.description,
        stock: c.stock,
        price1: extractMinQPrice(c.price),
        in_stock: c.stock > 0,
        package: c.package || "",
        kicad_footprint: c.kicad_footprint,
        jlc_part_number: c.jlc_part_number,
        sensor_type: sensorType,
        measures_air_quality: measuresAirQuality,
        measures_co2: measuresCo2,
        measures_oxygen: measuresOxygen,
        measures_carbon_monoxide: measuresCarbonMonoxide,
        measures_methane: measuresMethane,
        measures_nitrogen_oxides: measuresNitrogenOxides,
        measures_sulfur_hexafluoride: measuresSulfurHexafluoride,
        measures_volatile_organic_compounds: measuresVOC,
        measures_formaldehyde: measuresFormaldehyde,
        measures_hydrogen: measuresHydrogen,
        measures_explosive_gases: measuresExplosive,
        attributes: {},
      }
    })
  },
}
