import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

const extendedPromotionalWhereSql = sql`
  COALESCE(basic, 0) = 0
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
`

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components from source metadata",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql`
      SELECT name FROM pragma_table_info('components')
      WHERE name = 'is_extended_promotional'
    `.execute(db)

    return result.rows.length > 0
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)

    await sql`
      UPDATE components
      SET is_extended_promotional = 1
      WHERE ${extendedPromotionalWhereSql}
    `.execute(db)

    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
