export interface BaseComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  attributes: Record<string, string>
}
