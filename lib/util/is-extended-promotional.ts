export const isExtendedPromotional = (component: {
  basic: unknown
  preferred: unknown
}): boolean => Boolean(component.preferred) && !Boolean(component.basic)
