import { sql } from "kysely"
import type { DbOptimizationSpec } from "./types"
import type { KyselyDatabaseInstance } from "../kysely-types"

export const componentExtendedPromotionalColumn: DbOptimizationSpec = {
  name: "add_components_is_extended_promotional_column",
  description:
    "Adds is_extended_promotional boolean column to components (preferred=1 AND basic=0 — Extended parts marked Preferred are sold at Basic-tier assembly cost during JLCPCB promotions). Also rebuilds v_components view to expose the new column.",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    const {
      rows: [row],
    } = await sql<any>`
      SELECT * FROM components LIMIT 1
    `.execute(db)

    return row != null && "is_extended_promotional" in row
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      ALTER TABLE components
      ADD COLUMN is_extended_promotional boolean
      GENERATED ALWAYS AS (preferred = 1 AND basic = 0)
    `.execute(db)

    await db.schema
      .createIndex("idx_components_is_extended_promotional")
      .on("components")
      .column("is_extended_promotional")
      .execute()

    // Rebuild v_components view (if it exists) so the new column is visible
    // to routes that query the view rather than the base components table.
    const { rows: viewRows } = await sql<{ sql: string | null }>`
      SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'v_components'
    `.execute(db)

    const existingViewSql = viewRows[0]?.sql
    if (existingViewSql) {
      await sql`DROP VIEW IF EXISTS v_components`.execute(db)
      const rebuilt = rebuildViewWithExtendedPromotional(existingViewSql)
      await sql.raw(rebuilt).execute(db)
    }
  },
}

/**
 * Inject `components.is_extended_promotional` into a stored CREATE VIEW
 * statement. Looks for the existing `components.preferred` projection and
 * appends the new column right after it. Falls back to the original SQL if
 * the expected pattern isn't found, so existing views are never silently
 * broken.
 */
export function rebuildViewWithExtendedPromotional(viewSql: string): string {
  const patterns: RegExp[] = [
    /(components\.preferred\s+AS\s+preferred)/i,
    /(components\.preferred)(?!\w)/i,
    /(\bpreferred\b(?!\s*[,)])\s*,)/i,
  ]
  for (const pattern of patterns) {
    if (pattern.test(viewSql)) {
      return viewSql.replace(
        pattern,
        (match) => `${match}, components.is_extended_promotional`,
      )
    }
  }
  return viewSql
}
