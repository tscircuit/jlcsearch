const TRUE_VALUES = new Set([
  "1",
  "true",
  "yes",
  "y",
  "extended promotional",
  "extended_promotional",
  "preferred extended",
  "preferred",
])

const normalize = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()

const hasExtendedPromotionalMarker = (value: unknown): boolean => {
  if (value == null) return false
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    const normalized = normalize(value)
    return (
      TRUE_VALUES.has(normalized) ||
      (normalized.includes("extended") &&
        (normalized.includes("promo") || normalized.includes("preferred")))
    )
  }
  if (Array.isArray(value)) return value.some(hasExtendedPromotionalMarker)
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => {
        const normalizedKey = normalize(key)
        return (
          (normalizedKey.includes("extended") &&
            (normalizedKey.includes("promo") ||
              normalizedKey.includes("preferred")) &&
            hasExtendedPromotionalMarker(nested)) ||
          hasExtendedPromotionalMarker(nested)
        )
      },
    )
  }
  return false
}

export const isExtendedPromotionalFromExtra = (
  extra: string | null,
): boolean => {
  if (!extra) return false
  try {
    const parsed = JSON.parse(extra)
    return [
      parsed?.is_extended_promotional,
      parsed?.isExtendedPromotional,
      parsed?.extendedPromotional,
      parsed?.extended_promotional,
      parsed?.preferredExtended,
      parsed?.preferred_extended,
      parsed?.attributes,
      parsed,
    ].some(hasExtendedPromotionalMarker)
  } catch {
    return hasExtendedPromotionalMarker(extra)
  }
}
