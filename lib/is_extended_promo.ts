export function isExtendedPromotional(component: { is_extended_promotional?: boolean; extra?: { promo?: boolean } }): boolean {
  return Boolean(component.is_extended_promotional || component.extra?.promo);
}
