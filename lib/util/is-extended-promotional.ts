/**
 * Determines whether a component is an "extended promotional" part.
 *
 * "Extended promotional" parts are JLCPCB extended parts that are temporarily
 * made available as basic parts (no per-part loading fee) for a limited
 * promotional period. In the upstream jlcparts data they are not flagged as
 * basic parts; instead the promotional library type is carried through in the
 * component `extra` JSON blob (the merged LCSC/JLC attributes, e.g. the
 * "Library Type" attribute reads "Basic/Promotional Extended" for these parts).
 *
 * This mirrors the SQL expression used for the generated
 * `is_extended_promotional` column on the `components` table (see
 * lib/db/optimizations/component-extended-promotional-column.ts).
 */
export const isExtendedPromotional = (
  basic: number | boolean | null | undefined,
  extra: string | null | undefined,
): boolean => {
  const isBasic = basic === 1 || basic === true
  if (isBasic) return false
  return (extra ?? "").toLowerCase().includes("promotional")
}
