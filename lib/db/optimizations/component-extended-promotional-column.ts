import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

const EXTENDED_PROMOTIONAL_CASE_SQL = sql`
  CASE
    WHEN json_valid(extra) AND lower(coalesce(json_extract(extra, '$.libraryType'), '')) IN ('extended promotional', 'extended_promo', 'extended-promo') THEN 1
    WHEN json_valid(extra) AND lower(coalesce(json_extract(extra, '$.library_type'), '')) IN ('extended promotional', 'extended_promo', 'extended-promo') THEN 1
    WHEN json_valid(extra) AND lower(coalesce(json_extract(extra, '$.extendedPromotional'), '')) IN ('1', 'true', 'yes') THEN 1
    WHEN json_valid(extra) AND lower(coalesce(json_extract(extra, '$.isExtendedPromotional'), '')) IN ('1', 'true', 'yes') THEN 1
    WHEN json_valid(extra) AND lower(coalesce(json_extract(extra, '$.extended_promotional'), '')) IN ('1', 'true', 'yes') THEN 1
    WHEN json_valid(extra) AND lower(coalesce(json_extract(extra, '$.is_extended_promotional'), '')) IN ('1', 'true', 'yes') THEN 1
    ELSE 0
  END
`

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "components.is_extended_promotional",
  description:
    "Adds and indexes components.is_extended_promotional from source metadata",

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
      SET is_extended_promotional = ${EXTENDED_PROMOTIONAL_CASE_SQL}
    `.execute(db)

    await db.schema
      .createIndex("idx_components_extended_promotional")
      .ifNotExists()
      .on("components")
      .column("is_extended_promotional")
      .execute()
  },
}
