type ComponentPromotionFields = {
  basic?: boolean | number | null
  preferred?: boolean | number | null
  extra?: string | null
  jlc_extra?: string | null
}

const getComponentLibraryType = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== "object") return null

  const record = metadata as Record<string, unknown>
  const directType = record.componentLibraryType
  if (typeof directType === "string") return directType

  const extra = record.extra
  if (extra && typeof extra === "object") {
    const nestedType = (extra as Record<string, unknown>).componentLibraryType
    if (typeof nestedType === "string") return nestedType
  }

  return null
}

const parseJson = (raw: string | null | undefined): unknown => {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const isExtendedPromotional = (
  component: ComponentPromotionFields,
): boolean => {
  const libraryTypes = [component.extra, component.jlc_extra]
    .map((raw) => getComponentLibraryType(parseJson(raw)))
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())

  if (
    libraryTypes.some((type) => type === "expand" || type === "expandprefer")
  ) {
    return true
  }

  return Boolean(component.preferred) && !component.basic
}
