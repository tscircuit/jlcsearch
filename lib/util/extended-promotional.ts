export interface ExtendedPromotionalComponentFields {
  basic?: number | boolean | null
  preferred?: number | boolean | null
  extra?: string | null
}

const extendedPromotionalKeys = new Set([
  "is_extended_promotional",
  "isExtendedPromotional",
  "extended_promotional",
  "extendedPromotional",
  "extendedPromo",
  "is_extended_promo",
])

const promotionalStringValues = new Set([
  "extended promotional",
  "extended_promotional",
  "extended-promotional",
  "extended promo",
  "extended_promo",
])

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "y"].includes(normalized)) return true
    if (["false", "0", "no", "n"].includes(normalized)) return false
    if (promotionalStringValues.has(normalized)) return true
  }
}

const findExtendedPromotionalFlag = (value: unknown): boolean | undefined => {
  const directValue = toBoolean(value)
  if (directValue !== undefined) return directValue

  if (Array.isArray(value)) {
    for (const item of value) {
      const flag = findExtendedPromotionalFlag(item)
      if (flag !== undefined) return flag
    }
    return undefined
  }

  if (!value || typeof value !== "object") return undefined

  for (const [key, nestedValue] of Object.entries(value)) {
    if (extendedPromotionalKeys.has(key)) {
      const flag = toBoolean(nestedValue)
      if (flag !== undefined) return flag
    }

    const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, "")
    if (
      normalizedKey.includes("extendedpromotional") ||
      normalizedKey.includes("extendedpromo")
    ) {
      const flag = toBoolean(nestedValue)
      if (flag !== undefined) return flag
    }

    const nestedFlag = findExtendedPromotionalFlag(nestedValue)
    if (nestedFlag !== undefined) return nestedFlag
  }
}

export const getIsExtendedPromotional = (
  component: ExtendedPromotionalComponentFields,
): boolean => {
  if (component.extra) {
    try {
      const extraFlag = findExtendedPromotionalFlag(JSON.parse(component.extra))
      if (extraFlag !== undefined) return extraFlag
    } catch {}
  }

  return Boolean(component.preferred) && !component.basic
}
