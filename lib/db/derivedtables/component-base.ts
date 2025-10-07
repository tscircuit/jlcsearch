export interface BaseComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  is_basic: boolean
  is_extended_promotional: boolean
  attributes: Record<string, string>
}
