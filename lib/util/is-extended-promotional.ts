type Booleanish = boolean | number | string | null | undefined

interface PromotionalFlags {
  basic?: Booleanish
  preferred?: Booleanish
  is_basic?: Booleanish
  is_preferred?: Booleanish
}

const isTruthyFlag = (value: Booleanish): boolean =>
  value === true || value === 1 || value === "1" || value === "true"

export const isExtendedPromotionalPart = (part: PromotionalFlags): boolean => {
  const preferred = part.preferred ?? part.is_preferred
  const basic = part.basic ?? part.is_basic

  return isTruthyFlag(preferred) && !isTruthyFlag(basic)
}
