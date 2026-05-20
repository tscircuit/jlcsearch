export const isExtendedPromotional = (component: {
  basic?: number | boolean | null
  preferred?: number | boolean | null
}): boolean => component.preferred === 1 && component.basic === 0
