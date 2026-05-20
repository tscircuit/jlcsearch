import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

const isExtendedPromotionalSql = sql`
  CASE
    WHEN COALESCE(basic, 0) = 0
      AND COALESCE(preferred, 0) = 0
      AND extra IS NOT NULL
      AND (
        LOWER(extra) LIKE '%promotional extended%'
        OR LOWER(extra) LIKE '%extended promotional%'
        OR LOWER(extra) LIKE '%promotional_extended%'
        OR LOWER(extra) LIKE '%extended_promotional%'
        OR LOWER(extra) LIKE '%promotionalextended%'
        OR LOWER(extra) LIKE '%extendedpromotional%'
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
      SELECT is_extended_promotional FROM components LIMIT 1
    `
      .execute(db)
      .catch(() => null)

    return Boolean(result)
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)

    await sql`
      UPDATE components
      SET is_extended_promotional = ${isExtendedPromotionalSql}
    `.execute(db)

    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
