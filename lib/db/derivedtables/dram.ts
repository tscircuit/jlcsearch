import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { BaseComponent } from "./component-base"
import type { DerivedTableSpec } from "./types"

export interface Dram extends BaseComponent {
  package: string
  memory_type: string
  memory_size_mbit: number | null
  clock_frequency_mhz: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
}

const DRAM_SUBCATEGORIES = ["DDR SDRAM", "SDRAM"] as const

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

const inferMemoryType = (text: string, subcategory?: string | null): string => {
  const normalized = text.toUpperCase()
  const match = normalized.match(/\b(LPDDR[2-5X]*|DDR[2-5]L?|DDR)\b/)
  if (match) return match[1]!
  return subcategory === "DDR SDRAM" ? "DDR" : "SDRAM"
}

export const dramTableSpec: DerivedTableSpec<Dram> = {
  tableName: "dram",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "memory_type", type: "text" },
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
    { name: "idx_dram_stock", columns: ["stock"] },
    { name: "idx_dram_package_stock", columns: ["package", "stock"] },
    {
      name: "idx_dram_memory_type_stock",
      columns: ["memory_type", "stock"],
    },
    {
      name: "idx_dram_memory_size_stock",
      columns: ["memory_size_mbit", "stock"],
    },
    {
      name: "idx_dram_clock_frequency_stock",
      columns: ["clock_frequency_mhz", "stock"],
    },
    { name: "idx_dram_is_basic_stock", columns: ["is_basic", "stock"] },
    {
      name: "idx_dram_is_preferred_stock",
      columns: ["is_preferred", "stock"],
    },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or(
          DRAM_SUBCATEGORIES.map((subcategory) =>
            eb("categories.subcategory", "=", subcategory),
          ),
        ),
      ),
  mapToTable: (components) =>
    components.map((component) => {
      try {
        const extra = component.extra ? JSON.parse(component.extra) : null
        const attributes: Record<string, string> = extra?.attributes ?? {}
        const description = String(component.description ?? "")
        const subcategory = (
          component as typeof component & { subcategory?: string | null }
        ).subcategory
        const searchableText = [
          description,
          attributes["Memory Type"],
          attributes.Technology,
          attributes.Type,
        ]
          .filter(Boolean)
          .join(" ")
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
          memory_type: inferMemoryType(searchableText, subcategory),
          memory_size_mbit: parseMemorySizeMbit(sizeSource),
          clock_frequency_mhz: parseClockFrequencyMhz(frequencySource),
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
