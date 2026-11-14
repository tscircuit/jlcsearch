import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { getD1Handler } from "../../cf-proxy/src/d1-routes"
import { CATEGORY_CRAWL_QUERY } from "../../scripts/crawl-live-stock"

const CATEGORY_INDEX = "idx_component_catalog_category_subcategory"

const readRepoFile = (path: string) =>
  Bun.file(new URL(`../../${path}`, import.meta.url)).text()

// The schema a full catalog sync creates in D1, before any rows are imported.
const catalogSchemaFromSyncScript = async () => {
  const script = await readRepoFile("cf-proxy/scripts/sync-db.sh")
  const schema = script.match(
    /<<'COMPONENT_CATALOG_SCHEMA_EXPORT'\n([\s\S]*?)\nCOMPONENT_CATALOG_SCHEMA_EXPORT/,
  )
  if (!schema) throw new Error("component_catalog schema not found")
  return schema[1]
}

const indexDefinitions = (sqlite: Database) =>
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

const explain = (sqlite: Database, sql: string, parameters: unknown[] = []) =>
  sqlite
    .query<{ detail: string }, any[]>(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...(parameters as any[]))
    .map((step) => step.detail)
    .join(" / ")

test("the category index migration matches what a catalog sync creates", async () => {
  const schema = await catalogSchemaFromSyncScript()
  const synced = new Database(":memory:")
  const migrated = new Database(":memory:")
  synced.exec(schema)
  // Production's catalog predates the index.
  migrated.exec(
    schema
      .split("\n")
      .filter((line) => !line.includes(CATEGORY_INDEX))
      .join("\n"),
  )
  expect(indexDefinitions(migrated)).not.toEqual(indexDefinitions(synced))

  const migration = await readRepoFile(
    "cf-proxy/migrations/0026_component_catalog_category_index.sql",
  )
  migrated.exec(migration)
  // Applying the migration twice must be harmless after a lost response.
  migrated.exec(migration)
  expect(indexDefinitions(migrated)).toEqual(indexDefinitions(synced))
})

test("category listings read the category index, not every catalog row", async () => {
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
  try {
    sqlite.exec(await catalogSchemaFromSyncScript())
    sqlite.exec(`
      INSERT INTO component_catalog (lcsc, category, subcategory, package, stock)
      VALUES (1, 'Resistors', 'Chip Resistor', '0402', 10),
        (2, 'Resistors', 'Chip Resistor', '0402', 5),
        (3, 'Resistors', 'Resistor Networks', '0603', 0),
        (4, 'Capacitors', 'MLCC', '0402', 7),
        (5, NULL, NULL, NULL, 1);
      CREATE TABLE _jlcsearch_stock_categories (category TEXT, subcategory TEXT,
        next_page INTEGER, cycle TEXT, expected_total INTEGER, consistent INTEGER,
        web_category TEXT, web_subcategory TEXT, attempted_at INTEGER,
        completed_at INTEGER, PRIMARY KEY (category, subcategory));`)
    const run = async (params: Record<string, string>) => {
      queries.length = 0
      const result = await getD1Handler("/categories/list")!(
        db as never,
        params,
      )
      expect(queries).toHaveLength(1)
      return {
        data: result.data,
        plan: explain(sqlite, queries[0].sql, [...queries[0].parameters]),
      }
    }

    const categories = await run({})
    expect(categories.data).toEqual({
      categories: [
        { category: "Capacitors", subcategory: "MLCC" },
        { category: "Resistors", subcategory: "Chip Resistor" },
      ],
    })
    expect(categories.plan).toContain(`USING COVERING INDEX ${CATEGORY_INDEX}`)
    expect(categories.plan).not.toContain("TEMP B-TREE")

    const subcategories = await run({ category_name: "Resistors" })
    expect(subcategories.data).toEqual({
      categories: [
        { category: "Resistors", subcategory: "Chip Resistor" },
        { category: "Resistors", subcategory: "Resistor Networks" },
      ],
    })
    expect(subcategories.plan).toContain(
      `USING COVERING INDEX ${CATEGORY_INDEX} (category=?)`,
    )

    // The hourly stock crawl starts with the same distinct category pairs.
    expect(
      explain(sqlite, CATEGORY_CRAWL_QUERY.replace(/;\s*$/, "")),
    ).toContain(`component_catalog USING COVERING INDEX ${CATEGORY_INDEX}`)
  } finally {
    await db.destroy()
  }
})
