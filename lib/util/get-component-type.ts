/**
 * Utility to derive boolean component-type flags from a raw JLCPCB
 * `componentLibraryType` / `libraryType` field value.
 *
 * JLCPCB data source values (as observed in their component CSV/API):
 *   "base"             → Basic part  (lowest surcharge, always available)
 *   "expand"           → Preferred extended part
 *   "extend"           → Standard extended part (has placement fee)
 *   "promotion"        → Extended-promotional part (acts like basic temporarily)
 *   "promotionextend"  → Extended-promotional (alternate spelling seen in data)
 *
 * Numeric values used in some dataset exports:
 *   0 → base  (is_basic)
 *   1 → expand / preferred
 *   2 → extend
 *   3 → promotion  (is_extended_promotional)
 */
export interface ComponentTypeFlags {
  is_basic: number
  is_preferred: number
  is_extended_promotional: number
}

export function getComponentTypeFlags(
  rawLibraryType: string | number | null | undefined,
): ComponentTypeFlags {
  if (rawLibraryType === null || rawLibraryType === undefined) {
    return { is_basic: 0, is_preferred: 0, is_extended_promotional: 0 }
  }

  // Numeric form
  if (typeof rawLibraryType === "number") {
    return {
      is_basic: rawLibraryType === 0 ? 1 : 0,
      is_preferred: rawLibraryType === 1 ? 1 : 0,
      is_extended_promotional: rawLibraryType === 3 ? 1 : 0,
    }
  }

  const t = rawLibraryType.toString().toLowerCase().trim()

  return {
    is_basic: t === "base" ? 1 : 0,
    is_preferred: t === "expand" || t === "preferred" ? 1 : 0,
    is_extended_promotional:
      t === "promotion" ||
      t === "promotionextend" ||
      t === "extended_promotional"
        ? 1
        : 0,
  }
}
