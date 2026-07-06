import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

const columnName = "is_extended_promotional"

const hasExtendedPromotionalColumn = async (db: KyselyDatabaseInstance) => {
  const result = await sql<{ name: string }>`
    PRAGMA table_xinfo(components)
  `.execute(db)

  return result.rows.some((row) => row.name === columnName)
}

const hasExtendedPromotionalIndex = async (db: KyselyDatabaseInstance) => {
  const result = await sql`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name='idx_components_extended_promotional'
  `.execute(db)

  return result.rows.length > 0
}

export const componentExtendedPromotionalIndex: DbOptimizationSpec = {
  name: "idx_components_extended_promotional",
  description:
    "Generated extended promotional component column and index for faster queries",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    return (
      (await hasExtendedPromotionalColumn(db)) &&
      (await hasExtendedPromotionalIndex(db))
    )
  },

  async execute(db: KyselyDatabaseInstance) {
    if (!(await hasExtendedPromotionalColumn(db))) {
      await sql`
        ALTER TABLE components
        ADD COLUMN is_extended_promotional boolean
        GENERATED ALWAYS AS (
          CASE WHEN preferred = 1 AND basic = 0 THEN 1 ELSE 0 END
        )
      `.execute(db)
    }

    await sql`
      CREATE INDEX IF NOT EXISTS idx_components_extended_promotional
      ON components(is_extended_promotional)
    `.execute(db)
  },
}
