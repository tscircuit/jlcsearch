const EXTENDED_PROMOTIONAL_PATTERNS = [
  "extended promotional",
  "promotional extended",
]

const EXTENDED_PROMOTIONAL_KEYS = new Set([
  "is_extended_promotional",
  "isExtendedPromotional",
  "extended_promotional",
  "extendedPromotional",
  "promotional_extended",
  "promotionalExtended",
])

const normalizeMarker = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const valueIndicatesExtendedPromotional = (value: unknown): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value !== "string") return false

  const normalized = normalizeMarker(value)
  return EXTENDED_PROMOTIONAL_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  )
}

const metadataHasExtendedPromotionalMarker = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(metadataHasExtendedPromotionalMarker)
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, entryValue]) => {
      if (EXTENDED_PROMOTIONAL_KEYS.has(key)) {
        return valueIndicatesExtendedPromotional(entryValue)
      }

      if (
        valueIndicatesExtendedPromotional(key) &&
        valueIndicatesExtendedPromotional(entryValue)
      ) {
        return true
      }

      return metadataHasExtendedPromotionalMarker(entryValue)
    })
  }

  return valueIndicatesExtendedPromotional(value)
}

export const isExtendedPromotionalComponent = (
  extra: string | null | undefined,
  basic?: boolean | number | null,
  preferred?: boolean | number | null,
): boolean => {
  if (Boolean(basic) || Boolean(preferred) || !extra) return false

  try {
    return metadataHasExtendedPromotionalMarker(JSON.parse(extra))
  } catch {
    return valueIndicatesExtendedPromotional(extra)
  }
}
