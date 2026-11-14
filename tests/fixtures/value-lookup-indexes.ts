import { Database } from "bun:sqlite"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"

export const INDEX_MIGRATIONS = [
  "0024_resistor_value_index.sql",
  "0025_capacitor_value_index.sql",
]
export const NEW_INDEXES = [
  "idx_resistor_resistance",
  "idx_capacitor_capacitance_farads",
  "idx_resistor_array_resistance",
]
export const VALUE_TABLES = ["resistor", "capacitor", "resistor_array"]

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

export const openDatabase = () => {
  const sqlite = new Database(":memory:")
  const queries: Array<{ sql: string; parameters: readonly unknown[] }> = []
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database: sqlite }),
    log: (event) => {
      if (event.level === "query") {
        queries.push({
          sql: event.query.sql,
          parameters: event.query.parameters,
        })
      }
    },
  })
  return { sqlite, db, queries }
}
