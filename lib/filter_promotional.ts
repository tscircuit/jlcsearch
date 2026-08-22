export interface JlcComponentItem {
  lcsc: number;
  mfr: string;
  is_extended?: boolean;
  is_promotional?: boolean;
}

export function filterPromotionalExtendedComponents(items: JlcComponentItem[]): JlcComponentItem[] {
  return items.filter((it) => it.is_extended && it.is_promotional);
}
