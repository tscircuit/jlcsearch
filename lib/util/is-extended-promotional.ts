export const isExtendedPromotional = (component: {
  basic?: number | boolean | null
  preferred?: number | boolean | null
}): boolean => Boolean(component.preferred) && !Boolean(component.basic)
