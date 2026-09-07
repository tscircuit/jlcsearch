import { sql } from "kysely"

export const parsePromotionalFilter = (
  value: string | undefined,
): 0 | 1 | undefined =>
  value === "true" || value === "1"
    ? 1
    : value === "false" || value === "0"
      ? 0
      : undefined

// Category tables are rebuilt independently. Resolve this temporary status from
// the daily-refreshed catalog, using its unique LCSC index, rather than copying
// status into every category schema. Missing catalog rows fail closed.
export const catalogPromotionalStatus = (
  tableName: string,
) => sql<number>`coalesce((
  SELECT promotional_catalog.is_extended_promotional
  FROM component_catalog AS promotional_catalog
  WHERE promotional_catalog.lcsc = ${sql.id(tableName, "lcsc")}
  LIMIT 1
), 0)`
