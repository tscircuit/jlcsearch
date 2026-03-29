import type { Generated } from "kysely"

export interface ComponentsTable {
  id: Generated<number>
  lcsc: number
  mfr: string
  description: string
  package: string | null
  stock: number
  price1: number | null
  in_stock: number
  is_basic: number
  is_preferred: number
  is_extended_promotional: number
  voltage_rating: number | null
  current_rating: number | null
  power_rating: number | null
  resistance: number | null
  capacitance: number | null
  inductance: number | null
  tolerance: number | null
  frequency: number | null
  extra: string | null
  datasheet_url: string | null
  mfr_img_url: string | null
}

export interface Database {
  components: ComponentsTable
}
