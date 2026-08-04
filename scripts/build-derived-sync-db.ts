import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import type { DB } from "lib/db/generated/kysely"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"

const tableExists = (database: Database, schema: string, table: string) =>
  Boolean(
    database
      .query(
        `SELECT 1
         FROM ${schema}.sqlite_master
         WHERE type = 'table' AND name = ?
         LIMIT 1`,
      )
      .get(table),
  )

export const buildDerivedSyncDatabase = async ({
  sourcePath,
  outputPath,
  tableNames,
  logger = console.log,
}: {
  sourcePath: string
  outputPath: string
  tableNames?: string[]
  logger?: (message: string) => void
}) => {
  const resolvedSourcePath = path.resolve(sourcePath)
  const resolvedOutputPath = path.resolve(outputPath)

  if (!existsSync(resolvedSourcePath)) {
    throw new Error(`Source database does not exist: ${resolvedSourcePath}`)
  }
  if (resolvedSourcePath === resolvedOutputPath) {
    throw new Error("Source and output database paths must be different")
  }

  await mkdir(path.dirname(resolvedOutputPath), { recursive: true })
  await rm(resolvedOutputPath, { force: true })

  const database = new Database(resolvedOutputPath, { create: true })
  database.run("ATTACH DATABASE ? AS source", [resolvedSourcePath])

  if (
    !tableExists(database, "source", "jlc_components") ||
    !tableExists(database, "source", "lcsc_components")
  ) {
    database.close()
    throw new Error(
      "Expected a source-db-v2 database with jlc_components and lcsc_components",
    )
  }

  database.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      UNIQUE(category, subcategory)
    );

    INSERT INTO categories(category, subcategory)
    SELECT DISTINCT category, subcategory
    FROM source.jlc_components
    WHERE present = 1
      AND last_on_stock >= unixepoch('now', '-1 year')
    ORDER BY category, subcategory;

    CREATE TEMP VIEW components AS
    SELECT
      j.lcsc,
      c.id AS category_id,
      j.mfr,
      j.package,
      j.joints,
      0 AS manufacturer_id,
      CASE WHEN j.library_type = 'base' THEN 1 ELSE 0 END AS basic,
      j.preferred,
      j.description,
      j.datasheet,
      j.stock,
      j.price,
      j.last_on_stock,
      j.fetched_at AS last_update,
      j.sync_seen AS flag,
      CASE WHEN j.stock > 0 THEN 1 ELSE 0 END AS in_stock,
      json_object(
        'attributes',
        json(
          json_patch(
            CASE
              WHEN json_valid(j.attributes) THEN j.attributes
              ELSE '{}'
            END,
            CASE
              WHEN json_valid(l.attributes) THEN l.attributes
              ELSE '{}'
            END
          )
        ),
        'manufacturer',
        NULLIF(l.manufacturer, ''),
        'url',
        CASE
          WHEN l.url_slug IS NOT NULL AND l.url_slug != ''
          THEN 'https://lcsc.com/product-detail/' || l.url_slug || '_C' || j.lcsc || '.html'
          ELSE NULL
        END
      ) AS extra
    FROM source.jlc_components AS j
    INNER JOIN main.categories AS c
      ON c.category = j.category
      AND c.subcategory = j.subcategory
    LEFT JOIN source.lcsc_components AS l ON l.lcsc = j.lcsc
    WHERE j.present = 1
      AND j.last_on_stock >= unixepoch('now', '-1 year');
  `)

  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await setupDerivedTables({
      db,
      tableNames,
      logger,
    })
    database.exec("ANALYZE")
  } finally {
    await db.destroy()
    database.close()
  }
}

const main = async () => {
  const sourcePath =
    process.env.SOURCE_DB_PATH?.trim() || path.resolve("cache.sqlite3")
  const outputPath =
    process.env.OUTPUT_DB_PATH?.trim() || path.resolve("db.sqlite3")
  const configuredTables = process.env.DERIVED_TABLES_LIST?.split(",")
    .map((table) => table.trim())
    .filter(Boolean)

  await buildDerivedSyncDatabase({
    sourcePath,
    outputPath,
    tableNames: configuredTables?.length ? configuredTables : undefined,
  })
}

if (import.meta.main) {
  await main()
}
