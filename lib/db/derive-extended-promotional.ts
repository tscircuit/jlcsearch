type ComponentSource = {
  basic?: number | boolean | null
  preferred?: number | boolean | null
  extra?: string | Record<string, unknown> | null
}

const EXTENDED_PROMOTIONAL_LIBRARY_TYPES = new Set(["expand", "expandprefer"])

const parseExtra = (
  extra: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  if (!extra) return null
  if (typeof extra === "object") return extra

  try {
    const parsed = JSON.parse(extra)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export const isExtendedPromotionalLibraryType = (value: unknown): boolean =>
  typeof value === "string" &&
  EXTENDED_PROMOTIONAL_LIBRARY_TYPES.has(value.toLowerCase())

export const deriveIsExtendedPromotional = (
  component: ComponentSource,
): boolean => {
  const extra = parseExtra(component.extra)
  const libraryType = extra?.componentLibraryType

  if (isExtendedPromotionalLibraryType(libraryType)) {
    return true
  }

  return Boolean(component.preferred) && !Boolean(component.basic)
}

export const extendedPromotionalSqlCondition = `
  (
    CASE
      WHEN json_valid(extra) THEN lower(json_extract(extra, '$.componentLibraryType')) IN ('expand', 'expandprefer')
      ELSE 0
    END
    OR (preferred = 1 AND coalesce(basic, 0) = 0)
  )
`
