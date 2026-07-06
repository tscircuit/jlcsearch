export interface ComponentPromotionFlags {
  basic?: unknown
  preferred?: unknown
}

export const isExtendedPromotional = (
  component: ComponentPromotionFlags,
): boolean => Boolean(component.preferred) && !component.basic
