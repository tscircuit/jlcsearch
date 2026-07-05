import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

const columnName = "is_extended_promotional"

const hasExtendedPromotionalColumn = async (db: KyselyDatabaseInstance) => {
  const result = await sql<{ name: string }>`
    PRAGMA table_info(components)
  `.execute(db)

  return result.rows.some((row) => row.name === columnName)
}

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "idx_components_extended_promotional",
  description:
    "Adds and indexes components.is_extended_promotional from the JLCPCB preferred flag",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const indexResult = await sql`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name=${this.name}
    `.execute(db)

    return (
      (await hasExtendedPromotionalColumn(db)) && indexResult.rows.length > 0
    )
  },

  async execute(db: KyselyDatabaseInstance) {
    if (!(await hasExtendedPromotionalColumn(db))) {
      await sql`
        ALTER TABLE components
        ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0
      `.execute(db)
    }

    await sql`
      UPDATE components
      SET is_extended_promotional = CASE WHEN preferred = 1 THEN 1 ELSE 0 END
    `.execute(db)

    await sql`
      CREATE INDEX IF NOT EXISTS idx_components_extended_promotional
      ON components (is_extended_promotional)
    `.execute(db)
  },
}
