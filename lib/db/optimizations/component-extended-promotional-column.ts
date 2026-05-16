import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components table extracted from extra JSON",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [ex],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return ex && "is_extended_promotional" in ex
  },

  async execute(db: KyselyDatabaseInstance) {
    // Add the column. We use a regular column because SQLite GENERATED ALWAYS AS 
    // doesn't support JSON_EXTRACT in older versions, and it's safer to just populate it.
    await sql`
      ALTER TABLE components 
      ADD COLUMN is_extended_promotional boolean DEFAULT 0
    `.execute(db)

    // Populate the column from extra JSON
    // We assume extra is a JSON string and contains is_extended_promotional
    await sql`
      UPDATE components 
      SET is_extended_promotional = (
        SELECT CASE 
          WHEN json_extract(extra, '$.is_extended_promotional') = 1 THEN 1 
          WHEN json_extract(extra, '$.is_extended_promotional') = 'true' THEN 1
          ELSE 0 
        END
      )
    `.execute(db)

    // Create an index on the new column
    await db.schema
      .createIndex("idx_components_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()

    // Recreate v_components to include the new column if it's a view
    // Note: We use execute to run raw SQL for the view
    await sql`DROP VIEW IF EXISTS v_components;`.execute(db)
    await sql`
      CREATE VIEW v_components AS
      SELECT 
        components.*,
        categories.category,
        categories.subcategory
      FROM components
      LEFT JOIN categories ON components.category_id = categories.id;
    `.execute(db)
  },
}
