import type { SelectQueryBuilder } from "kysely"

export interface ComponentPromotionFlags {
  basic: number | boolean | null
  preferred: number | boolean | null
}

export interface ComponentPromotionFilterParams {
  is_basic?: boolean
  is_preferred?: boolean
  is_extended_promotional?: boolean
}

export const isExtendedPromotional = (
  component: ComponentPromotionFlags,
): boolean => Boolean(component.preferred) && !Boolean(component.basic)

export const applyPromotionalComponentFilters = <DB, TB extends keyof DB, O>(
  query: SelectQueryBuilder<DB, TB, O>,
  filters: ComponentPromotionFilterParams,
): SelectQueryBuilder<DB, TB, O> => {
  if (filters.is_extended_promotional) {
    return query.where("preferred" as any, "=", 1).where("basic" as any, "=", 0)
  }

  let filteredQuery = query
  if (filters.is_basic) {
    filteredQuery = filteredQuery.where("basic" as any, "=", 1)
  }
  if (filters.is_preferred) {
    filteredQuery = filteredQuery.where("preferred" as any, "=", 1)
  }

  return filteredQuery
}
