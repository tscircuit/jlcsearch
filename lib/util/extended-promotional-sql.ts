import { sql } from "kysely"

export const extendedPromotionalSql = sql<number>`
  CASE
    WHEN COALESCE(basic, 0) = 0
      AND COALESCE(preferred, 0) = 0
      AND extra IS NOT NULL
      AND (
        extra LIKE '%extended promotional%' COLLATE NOCASE
        OR extra LIKE '%promotional extended%' COLLATE NOCASE
        OR extra LIKE '%extended_promotional%' COLLATE NOCASE
        OR extra LIKE '%promotional_extended%' COLLATE NOCASE
        OR extra LIKE '%extended-promotional%' COLLATE NOCASE
        OR extra LIKE '%promotional-extended%' COLLATE NOCASE
      )
    THEN 1
    ELSE 0
  END
`
