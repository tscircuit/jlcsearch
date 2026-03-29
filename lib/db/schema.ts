import type { Generated } from "kysely"

export interface ComponentsTable {
  id: Generated<number>
  lcsc: number
  mfr: string
  description: string
  package: string | null
  joints: number | null
  manufacturer: string | null
  basic: number
  preferred: number
  is_extended_promotional: number
  last_updated: string | null
  stock: number | null
  price1: number | null
  price10: number | null
  price100: number | null

  // Derived / category columns added by derived-tables scripts
  [key: string]: unknown
}

export interface Database {
  components: ComponentsTable
}
