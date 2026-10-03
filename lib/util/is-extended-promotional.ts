/**
 * JLCPCB "extended promotional" parts act as basic for a limited time.
 * In the jlcparts / components dump this is encoded as preferred=1 with basic=0
 * (preferred parts are never basic in practice; both conditions keep the
 * mapping explicit and stable if that ever changes).
 */
export function isExtendedPromotional(
  basic: number | boolean | null | undefined,
  preferred: number | boolean | null | undefined,
): boolean {
  return Boolean(preferred) && !basic
}
