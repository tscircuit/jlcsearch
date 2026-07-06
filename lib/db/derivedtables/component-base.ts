export interface BaseComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
  price1: number | null
  in_stock: boolean
  is_basic: boolean
  is_preferred: boolean
  is_extended_promotional: boolean
  attributes: Record<string, string>
}

export function isExtendedPromotional(extra: string | null): boolean {
  try {
    const parsed = JSON.parse(extra ?? "{}")
    const libType = parsed?.componentLibraryType
    return libType === "expand" || libType === "expandPrefer"
  } catch {
    return false
  }
}
