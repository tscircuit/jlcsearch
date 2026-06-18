import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

const columnName = "is_extended_promotional"
const indexName = "idx_components_is_extended_promotional"

const hasExtendedPromotionalColumn = async (db: KyselyDatabaseInstance) => {
  const result = await sql<{ name: string }>`
    PRAGMA table_xinfo(components)
  `.execute(db)

  return result.rows.some((row) => row.name === columnName)
}

const hasExtendedPromotionalIndex = async (db: KyselyDatabaseInstance) => {
  const result = await sql<{ name: string }>`
    SELECT name FROM sqlite_master
    WHERE type='index' AND name=${indexName}
  `.execute(db)

  return result.rows.length > 0
}

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional column to components derived from preferred and basic flags",

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
        GENERATED ALWAYS AS (preferred = 1 AND basic = 0)
      `.execute(db)
    }

    await sql`
      CREATE INDEX IF NOT EXISTS idx_components_is_extended_promotional
      ON components(is_extended_promotional)
    `.execute(db)
  },
}
