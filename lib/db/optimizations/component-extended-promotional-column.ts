import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds components.extended_promotional from the JLCPCB extra metadata for filterable extended promotional parts",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const result = await sql<{ name: string }>`
      PRAGMA table_info(components)
    `.execute(db)

    return result.rows.some((column) => column.name === "extended_promotional")
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN extended_promotional boolean
      GENERATED ALWAYS AS (
        COALESCE(
          json_extract(extra, '$.is_extended_promotional'),
          json_extract(extra, '$.isExtendedPromotional'),
          json_extract(extra, '$.extended_promotional'),
          json_extract(extra, '$.extendedPromotional'),
          0
        ) IN (1, '1', 'true', 'TRUE', 'True')
      )
    `.execute(db)

    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("extended_promotional")
      .execute()
  },
}
