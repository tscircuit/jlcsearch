const isTruthy = (value: unknown): boolean => {
  if (value === true || value === 1) return true
  if (typeof value !== "string") return false

  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

export const isExtendedPromotional = (
  basic: unknown,
  preferred: unknown,
): boolean => {
  return isTruthy(preferred) && !isTruthy(basic)
}
