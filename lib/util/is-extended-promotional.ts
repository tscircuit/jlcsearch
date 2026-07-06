export const isExtendedPromotional = (component: {
  basic?: number | boolean | null
  preferred?: number | boolean | null
}) => Boolean(component.preferred) && !component.basic
