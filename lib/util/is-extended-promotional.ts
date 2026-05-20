const PROMOTIONAL_EXTENDED_PATTERNS = [
  "promotional extended",
  "extended promotional",
  "promotional_extended",
  "extended_promotional",
]

const PROMOTIONAL_EXTENDED_BOOLEAN_KEYS = new Set([
  "is_extended_promotional",
  "isExtendedPromotional",
  "extendedPromotional",
  "promotionalExtended",
  "promotional_extended",
  "extended_promotional",
  "promotionalExtendedFlag",
  "promotionExtendedFlag",
])

const valueLooksPromotionalExtended = (value: unknown): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value !== "string") return false

  const normalized = value
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .trim()
  return PROMOTIONAL_EXTENDED_PATTERNS.some((pattern) =>
    normalized.includes(pattern.replace(/[-_/]+/g, " ")),
  )
}

const hasPromotionalExtendedMarker = (value: unknown): boolean => {
  if (!value || typeof value !== "object") {
    return typeof value === "string" && valueLooksPromotionalExtended(value)
  }
  if (Array.isArray(value)) return value.some(hasPromotionalExtendedMarker)

  for (const [key, entryValue] of Object.entries(value)) {
    if (
      PROMOTIONAL_EXTENDED_BOOLEAN_KEYS.has(key) &&
      valueLooksPromotionalExtended(entryValue)
    ) {
      return true
    }

    if (
      valueLooksPromotionalExtended(key) &&
      valueLooksPromotionalExtended(entryValue)
    ) {
      return true
    }

    if (hasPromotionalExtendedMarker(entryValue)) {
      return true
    }
  }

  return false
}

export const isExtendedPromotionalComponent = (
  extra: string | null | undefined,
  basic?: number | boolean | null,
  preferred?: number | boolean | null,
): boolean => {
  if (Boolean(basic) || Boolean(preferred) || !extra) return false

  try {
    return hasPromotionalExtendedMarker(JSON.parse(extra))
  } catch {
    return valueLooksPromotionalExtended(extra)
  }
}
