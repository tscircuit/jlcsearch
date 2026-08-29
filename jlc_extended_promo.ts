/**
 * tscircuit / jlcsearch extended promotional component flag
 */
export interface ComponentRecord {
  lcsc: number;
  mfr: string;
  description: string;
  is_extended_promotional?: boolean;
  stock: number;
}

export function filterPromotionalComponents(items: ComponentRecord[]): ComponentRecord[] {
  return items.filter(item => Boolean(item.is_extended_promotional));
}
