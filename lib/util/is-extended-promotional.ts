export const isExtendedPromotional = (component: {
  basic?: boolean | number | null
  preferred?: boolean | number | null
}): boolean => Boolean(component.preferred) && !Boolean(component.basic)
