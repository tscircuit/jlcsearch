type ComponentPromotionFlags = {
  basic?: boolean | number | string | null
  preferred?: boolean | number | string | null
  is_basic?: boolean | number | string | null
  is_preferred?: boolean | number | string | null
}

const isTruthyFlag = (value: boolean | number | string | null | undefined) =>
  value === true || value === 1 || value === "1" || value === "true"

export const isExtendedPromotional = (component: ComponentPromotionFlags) => {
  const basic = component.basic ?? component.is_basic
  const preferred = component.preferred ?? component.is_preferred

  return isTruthyFlag(preferred) && !isTruthyFlag(basic)
}
