import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds components.extended_promotional, populated from the JLCPCB extended promotional source sync script",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql<{ name: string }>`
      PRAGMA table_info(components)
    `.execute(db)

    return result.rows.some((row) => row.name === "extended_promotional")
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components ADD COLUMN extended_promotional INTEGER
    `.execute(db)
  },
}
