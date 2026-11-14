import { expect, test } from "bun:test"
import { setupDerivedTables } from "../../lib/db/derivedtables/setup-derived-tables"
import {
  INDEX_MIGRATIONS,
  NEW_INDEXES,
  VALUE_TABLES,
  indexDefinitions,
  openDatabase,
  readRepoFile,
} from "../fixtures/value-lookup-indexes"

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
