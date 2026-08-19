import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { microUsbConnectorTableSpec } from "lib/db/derivedtables/micro-usb-connector"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const EXPECTED_INDEX_COUNT = 8

test("derived table setup creates the Micro USB table and indexes", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await setupDerivedTables({ db, populate: false })

    const table = database
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(microUsbConnectorTableSpec.tableName)
    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'",
      )
      .all(microUsbConnectorTableSpec.tableName)

    expect(table).not.toBeNull()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COUNT)
  } finally {
    await db.destroy()
  }
})

test("D1 migration creates the Micro USB schema idempotently", async () => {
  const database = new Database(":memory:")
  const migrationPath = new URL(
    "../../cf-proxy/migrations/0005_micro_usb_connector.sql",
    import.meta.url,
  )
  const migration = await Bun.file(migrationPath).text()

  try {
    database.exec(migration)
    database.exec(migration)

    const table = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'micro_usb_connector'",
      )
      .get()
    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'micro_usb_connector' AND name NOT LIKE 'sqlite_%'",
      )
      .all()

    expect(table).not.toBeNull()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COUNT)
  } finally {
    database.close()
  }
})
