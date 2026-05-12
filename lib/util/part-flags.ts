export const isTruthyPartFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === "1" || value === "true"

export const isExtendedPromotionalPart = (
  preferred: unknown,
  basic: unknown,
): boolean => isTruthyPartFlag(preferred) && !isTruthyPartFlag(basic)
