import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds extended_promotional boolean column to components table. " +
    "Extended promotional parts behave like basic parts for a limited time. " +
    "Derived from the raw JLCPCB libraryType field stored in jlcpcb_component_details.",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return ex != null && "extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column with a default of 0 (not extended promotional)
    await sql`
      ALTER TABLE components
      ADD COLUMN extended_promotional INTEGER NOT NULL DEFAULT 0
    `.execute(db)

    // Populate from jlcpcb_component_details.payload when available.
    // The JLCPCB OpenAPI stores libraryType as "extendedPromotional" or similar values.
    // We check for both snake_case and camelCase variants to be safe.
    await sql`
      UPDATE components
      SET extended_promotional = 1
      WHERE lcsc IN (
        SELECT lcsc
        FROM jlcpcb_component_details
        WHERE
          json_valid(payload) = 1
          AND (
            lower(json_extract(payload, '$.libraryType')) IN (
              'extended_promotional',
              'extendedpromotional',
              'promote',
              'promotion'
            )
            OR lower(json_extract(payload, '$.componentLibraryType')) IN (
              'extended_promotional',
              'extendedpromotional',
              'promote',
              'promotion'
            )
          )
      )
    `.execute(db)

    // Create an index for fast filtering
    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("extended_promotional")
      .execute()
  },
}
