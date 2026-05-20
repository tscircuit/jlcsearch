export const isExtendedPromotional = (component: {
  basic?: boolean | number | null
  preferred?: boolean | number | null
}) => Boolean(component.preferred) && !Boolean(component.basic)
