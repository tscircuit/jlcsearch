export interface BaseComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  is_basic: boolean
  is_preferred: boolean
  attributes: Record<string, string>
}

export const BASE_COMPONENT_COLUMNS = [
  { name: "lcsc", type: "integer", primaryKey: true },
  { name: "mfr", type: "text" },
  { name: "description", type: "text" },
  { name: "stock", type: "integer" },
  { name: "price1", type: "real" },
  { name: "in_stock", type: "boolean" },
  { name: "is_basic", type: "boolean" },
  { name: "is_preferred", type: "boolean" },
] as const
