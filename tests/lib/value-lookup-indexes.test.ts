import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { getD1Handler } from "../../cf-proxy/src/d1-routes"
import { setupDerivedTables } from "../../lib/db/derivedtables/setup-derived-tables"

const INDEX_MIGRATIONS = [
  "0024_resistor_value_index.sql",
  "0025_capacitor_value_index.sql",
]
const NEW_INDEXES = [
  "idx_resistor_resistance",
  "idx_capacitor_capacitance_farads",
  "idx_resistor_array_resistance",
]
const VALUE_TABLES = ["resistor", "capacitor", "resistor_array"]

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

const openDatabase = () => {
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

test("index migrations give production the indexes a fresh sync creates", async () => {
  const synced = openDatabase()
  const migrated = openDatabase()
  try {
    await setupDerivedTables({
      db: synced.db,
      populate: false,
      tableNames: VALUE_TABLES,
    })

    // Production already has these tables, without the new indexes.
    const existing = synced.sqlite
      .query<{ name: string; sql: string }, []>(
        `SELECT name, sql FROM sqlite_master WHERE sql IS NOT NULL
          ORDER BY type = 'index'`,
      )
      .all()
    for (const { name, sql } of existing) {
      if (!NEW_INDEXES.includes(name)) migrated.sqlite.exec(sql)
    }
    expect(indexDefinitions(migrated.sqlite)).not.toEqual(
      indexDefinitions(synced.sqlite),
    )

    for (const file of INDEX_MIGRATIONS) {
      const migration = await readRepoFile(`cf-proxy/migrations/${file}`)
      migrated.sqlite.exec(migration)
      // Applying a migration twice must be harmless after a lost response.
      migrated.sqlite.exec(migration)
    }

    expect(indexDefinitions(migrated.sqlite)).toEqual(
      indexDefinitions(synced.sqlite),
    )
  } finally {
    await synced.db.destroy()
    await migrated.db.destroy()
  }
})

test("value lookups and footprint counts are answered from indexes", async () => {
  const { sqlite, db, queries } = openDatabase()
  try {
    sqlite.exec(await catalogSchemaFromSyncScript())
    await setupDerivedTables({ db, populate: false, tableNames: VALUE_TABLES })
    sqlite.exec(`
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 12)
      INSERT INTO component_catalog (lcsc, package, stock)
      SELECT i, '0805', 1 FROM n UNION ALL SELECT 100, '0402', 1;
      INSERT INTO resistor (lcsc, stock, resistance, package)
      VALUES (1, 10, 4700, '0402'), (2, 5, 4700, '0603'), (3, 9, 10000, '0402');
      INSERT INTO capacitor (lcsc, stock, capacitance_farads, package)
      VALUES (4, 7, 1e-7, '0402'), (6, 3, 1e-6, '0402');
      INSERT INTO resistor_array (lcsc, stock, resistance, package)
      VALUES (7, 2, 4700, '0603');`)
    const run = async (path: string, params: Record<string, string>) => {
      queries.length = 0
      const handler = getD1Handler(path, { includeFilterOptions: false })!
      const result = await handler(db as never, params)
      const plans = queries.map(({ sql, parameters }) =>
        sqlite
          .query<{ detail: string }, any[]>(`EXPLAIN QUERY PLAN ${sql}`)
          .all(...(parameters as any[]))
          .map((step) => step.detail)
          .join(" / "),
      )
      return { data: result.data, plans }
    }

    const footprints = await run("/footprint_index/list", {})
    expect(footprints.data).toEqual({
      footprints: [
        {
          package: "0805",
          num_components: 12,
          footprinter_string: null,
          tscircuit_accepts: false,
        },
      ],
    })
    expect(footprints.plans).toHaveLength(1)
    expect(footprints.plans[0]).toContain(
      "USING COVERING INDEX idx_component_catalog_package",
    )

    for (const [path, params, index, lcsc] of [
      [
        "/resistors/list",
        { resistance: "4700", package: "0402" },
        "idx_resistor_resistance",
        1,
      ],
      [
        "/capacitors/list",
        { capacitance: "1e-7", package: "0402" },
        "idx_capacitor_capacitance_farads",
        4,
      ],
      [
        "/resistor_arrays/list",
        { resistance: "4700" },
        "idx_resistor_array_resistance",
        7,
      ],
    ] as const) {
      const lookup = await run(path, params)
      expect(Object.values(lookup.data)[0]).toMatchObject([{ lcsc }])
      expect(lookup.plans).toHaveLength(1)
      expect(lookup.plans[0]).toStartWith("SEARCH ")
      expect(lookup.plans[0]).toContain(`USING INDEX ${index}`)
    }
  } finally {
    await db.destroy()
  }
})
