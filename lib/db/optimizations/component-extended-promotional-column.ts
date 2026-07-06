import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table derived from preferred = 1 AND basic = 0 (JLCPCB extended parts that temporarily act as basic parts)",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // The upstream jlcparts database must provide the source columns. Error
    // loudly instead of inserting fake data if they're missing.
    const { rows: columns } = await sql<{ name: string }>`
      SELECT name FROM pragma_table_info('components')
    `.execute(db)
    const columnNames = new Set(columns.map((c) => c.name))

    for (const requiredColumn of ["preferred", "basic"]) {
      if (!columnNames.has(requiredColumn)) {
        throw new Error(
          `Cannot add is_extended_promotional: components.${requiredColumn} is missing from the source database`,
        )
      }
    }

    // Add the column
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (preferred = 1 AND basic = 0)
    `.execute(db)

    // Create an index on the new column
    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
