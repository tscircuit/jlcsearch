import type { Database } from "bun:sqlite"

export const CATEGORY_INDEX = "idx_component_catalog_category_subcategory"

export const readRepoFile = (path: string) =>
  Bun.file(new URL(`../../${path}`, import.meta.url)).text()

// The schema a full catalog sync creates in D1, before any rows are imported.
export const catalogSchemaFromSyncScript = async () => {
  const script = await readRepoFile("cf-proxy/scripts/sync-db.sh")
  const schema = script.match(
    /<<'COMPONENT_CATALOG_SCHEMA_EXPORT'\n([\s\S]*?)\nCOMPONENT_CATALOG_SCHEMA_EXPORT/,
  )
  if (!schema) throw new Error("component_catalog schema not found")
  return schema[1]
}

export const indexDefinitions = (sqlite: Database) =>
  sqlite
    .query<{ name: string; sql: string }, []>(
      `SELECT name, sql FROM sqlite_master WHERE type = 'index'
        AND sql IS NOT NULL ORDER BY name`,
    )
    .all()
    .map(({ name, sql }) => [
      name,
      sql.toLowerCase().replace(/if not exists|["`\s]/g, ""),
    ])

export const explain = (
  sqlite: Database,
  sql: string,
  parameters: unknown[] = [],
) =>
  sqlite
    .query<{ detail: string }, any[]>(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...(parameters as any[]))
    .map((step) => step.detail)
    .join(" / ")
