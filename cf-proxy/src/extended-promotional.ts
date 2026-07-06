export type ExtendedPromotionalSource = {
  basic?: boolean | number | string | null
  preferred?: boolean | number | string | null
}

const isEnabledFlag = (value: boolean | number | string | null | undefined) =>
  value === true || value === 1 || value === "1" || value === "true"

export const isExtendedPromotional = (
  component: ExtendedPromotionalSource,
): boolean =>
  isEnabledFlag(component.preferred) && !isEnabledFlag(component.basic)

export const parseBooleanFilter = (
  value: boolean | string | null | undefined,
): boolean | undefined => {
  if (value === true || value === false) return value
  if (value === undefined || value === null || value === "") return undefined

  const normalized = value.toLowerCase()
  if (normalized === "true" || normalized === "1") return true
  if (normalized === "false" || normalized === "0") return false
  return undefined
}
