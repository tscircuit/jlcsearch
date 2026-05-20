import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

const extendedPromotionalSql = sql`
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

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components from source metadata",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM pragma_table_xinfo('components')
      WHERE name = 'is_extended_promotional'
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional INTEGER
        GENERATED ALWAYS AS (${extendedPromotionalSql}) VIRTUAL
    `.execute(db)
  },
}
