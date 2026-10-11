/**
 * JLCPCB "extended promotional" parts act as basic for a limited time.
 * Encoded in the catalog as preferred=1 with basic=0.
 */
export function isExtendedPromotional(
  basic: number | boolean | null | undefined,
  preferred: number | boolean | null | undefined,
): boolean {
  return Boolean(preferred) && !basic
}

/** True when query param requests only extended-promotional parts. */
export function wantsExtendedPromotional(
  value: string | null | undefined,
): boolean {
  return value === "true" || value === "1"
}
