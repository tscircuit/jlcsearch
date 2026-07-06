const EXTENDED_PROMOTIONAL_FIELDS = [
  "libraryType",
  "library_type",
  "extendedPromotional",
  "isExtendedPromotional",
  "extended_promotional",
  "is_extended_promotional",
] as const

const EXTENDED_PROMOTIONAL_LIBRARY_TYPES = new Set([
  "extended promotional",
  "extended_promo",
  "extended-promo",
])

const TRUTHY_EXTENDED_PROMOTIONAL_VALUES = new Set(["1", "true", "yes"])

const normalize = (value: unknown): string => String(value ?? "").toLowerCase()

export function isExtendedPromotionalMetadata(extra: unknown): boolean {
  if (!extra || typeof extra !== "object") return false

  const metadata = extra as Record<string, unknown>
  for (const field of EXTENDED_PROMOTIONAL_FIELDS) {
    const value = normalize(metadata[field])
    if (field === "libraryType" || field === "library_type") {
      if (EXTENDED_PROMOTIONAL_LIBRARY_TYPES.has(value)) return true
    } else if (TRUTHY_EXTENDED_PROMOTIONAL_VALUES.has(value)) {
      return true
    }
  }

  return false
}
