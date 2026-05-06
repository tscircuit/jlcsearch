import { extractMinQPrice } from "lib/util/extract-min-quantity-price"
import type { DerivedTableSpec } from "./types"
import { BaseComponent } from "./component-base"

export interface FPGA extends BaseComponent {
  package: string
  type: string | null
  logic_array_blocks: number | null
  logic_elements: number | null
  embedded_ram_bits: number | null
  supply_voltage_min: number | null
  supply_voltage_max: number | null
  operating_temp_min: number | null
  operating_temp_max: number | null
  max_delay_ns: number | null
  logic_gates: number | null
}

const SUBCATEGORY_MATCHES = [
  "Programmable Logic Device (CPLDs/FPGAs)",
  "CPLD/FPGA",
  "CPLD & FPGA",
]

const parseNumericValue = (value?: string | null): number | null => {
  if (!value) return null
  const cleaned = value.replace(/[,\s]/g, "")
  const match = cleaned.match(/(-?[\d.]+)([kKmMgG]?)/)
  if (!match) return null
  let numeric = parseFloat(match[1]!)
  const suffix = match[2]?.toLowerCase()
  if (suffix === "k") numeric *= 1e3
  else if (suffix === "m") numeric *= 1e6
  else if (suffix === "g") numeric *= 1e9
  if (Number.isNaN(numeric)) return null
  return numeric
}

const parseRange = (
  value?: string | null,
): { min: number | null; max: number | null } => {
  if (!value) return { min: null, max: null }
  const matches = value.match(/-?[\d.]+/g)
  if (!matches || matches.length === 0) return { min: null, max: null }
  const numbers = matches
    .map((m) => parseFloat(m))
    .filter((n) => !Number.isNaN(n))
  if (numbers.length === 0) return { min: null, max: null }
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  }
}

export const fpgaTableSpec: DerivedTableSpec<FPGA> = {
  tableName: "fpga",
  extraColumns: [
    { name: "package", type: "text" },
    { name: "type", type: "text" },
    { name: "logic_array_blocks", type: "real" },
    { name: "logic_elements", type: "real" },
    { name: "embedded_ram_bits", type: "real" },
    { name: "supply_voltage_min", type: "real" },
    { name: "supply_voltage_max", type: "real" },
    { name: "operating_temp_min", type: "real" },
    { name: "operating_temp_max", type: "real" },
    { name: "max_delay_ns", type: "real" },
    { name: "logic_gates", type: "real" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
    { name: "is_extended_promotional", type: "boolean" },
  ],
  listCandidateComponents: (db) =>
    db
      .selectFrom("components")
      .innerJoin("categories", "components.category_id", "categories.id")
      .selectAll()
      .where((eb) =>
        eb.or(
          SUBCATEGORY_MATCHES.map((subcategory) =>
            eb("categories.subcategory", "=", subcategory),
          ),
        ),
      ),
  mapToTable: (components) =>
    components.map((c) => {
      try {
        const extra = c.extra ? JSON.parse(c.extra) : null
        const attrs: Record<string, string> = extra?.attributes ?? {}

        const supplyRange = parseRange(attrs["Supply Voltage Range - VCCIO"])
        const tempRange = parseRange(attrs["Operating Temperature Range"])

        return {
          lcsc: Number(c.lcsc),
          mfr: String(c.mfr ?? ""),
          description: String(c.description ?? ""),
          stock: Number(c.stock ?? 0),
          price1: extractMinQPrice(c.price),
          in_stock: Boolean((c.stock ?? 0) > 0),
          is_basic: Boolean(c.basic),
          is_preferred: Boolean(c.preferred),
        is_extended_promotional: Boolean(c.extended_promotional),
          package: extra?.package ?? c.package ?? "",
          type: attrs["Type"] ?? null,
          logic_array_blocks: parseNumericValue(attrs["Logic Array Blocks"]),
          logic_elements: parseNumericValue(attrs["Logic Elements / Cells"]),
          embedded_ram_bits: parseNumericValue(attrs["Embedded Block RAM"]),
          supply_voltage_min: supplyRange.min,
          supply_voltage_max: supplyRange.max,
          operating_temp_min: tempRange.min,
          operating_temp_max: tempRange.max,
          max_delay_ns: parseNumericValue(attrs["Maximum Delay Time Tpd"]),
          logic_gates: parseNumericValue(attrs["Number of Logic Gates"]),
          attributes: attrs,
        }
      } catch (err) {
        return null
      }
    }),
}
