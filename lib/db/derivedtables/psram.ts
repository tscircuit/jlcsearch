import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface Psram extends BaseComponent {
  package: string
  interface_type: string | null
  memory_size_mbit: number | null
  clock_frequency_mhz: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
}

const parseRange = (
  value?: string | null,
): { min: number | null; max: number | null } => {
  const matches = value?.match(/-?\d+(?:\.\d+)?/g)
  if (!matches?.length) return { min: null, max: null }

  const values = matches.map(Number).filter(Number.isFinite)
  return values.length
    ? { min: Math.min(...values), max: Math.max(...values) }
    : { min: null, max: null }
}

const parseMemorySizeMbit = (value?: string | null): number | null => {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*([KMG])bit\b/i)
  if (!match) return null

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  switch (match[2]?.toUpperCase()) {
    case "K":
      return amount / 1024
    case "G":
      return amount * 1024
    default:
      return amount
  }
}

const parseClockFrequencyMhz = (value?: string | null): number | null => {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*([MG])Hz\b/i)
  if (!match) return null

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  return match[2]?.toUpperCase() === "G" ? amount * 1000 : amount
}

const parseInterfaceType = (value: string): string | null => {
  const interfaces = value.match(/\b(?:QSPI|QPI|SPI|OPI|HyperBus|Parallel)\b/gi)
  return interfaces
    ? [...new Set(interfaces.map((item) => item.toUpperCase()))].join(", ")
    : null
}

export const psramTableSpec: DerivedTableSpec<Psram> = {
  tableName: "psram",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "interface_type", type: "text" },
    { name: "memory_size_mbit", type: "real" },
    { name: "clock_frequency_mhz", type: "real" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ],
  indexes: [
    { name: "idx_psram_stock", columns: ["stock"] },
    { name: "idx_psram_package_stock", columns: ["package", "stock"] },
    {
      name: "idx_psram_interface_type_stock",
      columns: ["interface_type", "stock"],
    },
    {
      name: "idx_psram_memory_size_stock",
      columns: ["memory_size_mbit", "stock"],
    },
    {
      name: "idx_psram_clock_frequency_stock",
      columns: ["clock_frequency_mhz", "stock"],
    },
    { name: "idx_psram_is_basic_stock", columns: ["is_basic", "stock"] },
    {
      name: "idx_psram_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or([
          eb("categories.subcategory", "=", "PSRAM"),
          // Source parts are also classified as SRAM, DRAM, or sourcing parts.
          // The trailing product type avoids MCUs/modules with embedded PSRAM.
          eb("components.description", "like", "% PSRAM ROHS%"),
          eb.and([
            eb("categories.subcategory", "in", ["SRAM", "DRAM"]),
            eb("components.description", "like", "%PSRAM%"),
          ]),
        ]),
      ),
  mapToTable: (components) =>
    components.map((component) => {
      try {
        const extra = component.extra ? JSON.parse(component.extra) : null
        const attributes: Record<string, string> = extra?.attributes ?? {}
        const description = String(component.description ?? "")
        const sizeSource =
          attributes["Memory Size"] ?? attributes.Density ?? description
        const frequencySource =
          attributes["Clock Frequency (fc)"] ??
          attributes["Clock Frequency"] ??
          description
        const supplyRange = parseRange(
          attributes["Supply Voltage"] ??
            attributes["Supply Voltage Range"] ??
            description.match(/\d+(?:\.\d+)?V~\d+(?:\.\d+)?V/)?.[0],
        )
        const temperatureRange = parseRange(
          attributes["Operating Temperature"] ??
            attributes["Operating Temperature Range"] ??
            description.match(/-?\d+(?:\.\d+)?℃~\+?\d+(?:\.\d+)?℃/)?.[0],
        )

        return {
          lcsc: Number(component.lcsc),
          mfr: String(component.mfr ?? ""),
          description,
          stock: Number(component.stock ?? 0),
          price1: extractMinQPrice(component.price),
          in_stock: Number(component.stock ?? 0) > 0,
          is_basic: Boolean(component.basic),
          is_preferred: Boolean(component.preferred),
          package: String(extra?.package ?? component.package ?? ""),
          interface_type:
            parseInterfaceType(attributes["Interface Type"] ?? "") ??
            parseInterfaceType(description),
          memory_size_mbit:
            parseMemorySizeMbit(sizeSource) ?? parseMemorySizeMbit(description),
          clock_frequency_mhz:
            parseClockFrequencyMhz(frequencySource) ??
            parseClockFrequencyMhz(description),
          supply_voltage_min: supplyRange.min,
          supply_voltage_max: supplyRange.max,
          operating_temp_min: temperatureRange.min,
          operating_temp_max: temperatureRange.max,
          attributes,
        }
      } catch {
        return null
      }
    }),
}
