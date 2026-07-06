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

type ComponentFlags = {
  basic?: number | boolean | null
  preferred?: number | boolean | null
  is_extended_promotional?: number | boolean | null
}

export const isExtendedPromotional = (component: ComponentFlags): boolean => {
  if (component.is_extended_promotional != null) {
    return Boolean(component.is_extended_promotional)
  }

  return Boolean(component.preferred) && !Boolean(component.basic)
}
