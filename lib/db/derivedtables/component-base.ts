export interface BaseComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  is_basic: boolean
  is_preferred: boolean
  /**
   * True for "extended" parts that carry the JLCPCB preferred/promotional
   * flag (a.k.a. extended promotional parts): assembled without extra fees
   * for a limited time even though they are not basic parts.
   */
  is_extended_promotional: boolean
  attributes: Record<string, string>
}
