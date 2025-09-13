export interface BaseComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  /** True if the component is classified as a JLCPCB basic part */
  is_basic_part?: boolean
  attributes: Record<string, string>
}
