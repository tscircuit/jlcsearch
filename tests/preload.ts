import { afterEach } from "bun:test"
import { sql } from "kysely"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { getDbClient, resetDbClient } from "lib/db/get-db-client"
import { componentView } from "lib/db/optimizations/component-view"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []
globalThis.derivedTablesSetupPromise ??= setupDerivedTables({ populate: false })

await globalThis.derivedTablesSetupPromise

const ensureRouteFixtureDatabase = async () => {
  const db = getDbClient()
  try {
    const requiredTables = await sql<{ name: string }>`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('components', 'categories', 'manufacturers')
    `.execute(db)

    if (requiredTables.rows.length !== 3) {
      await sql`
        CREATE TABLE IF NOT EXISTS manufacturers (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `.execute(db)

      await sql`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY,
          category TEXT NOT NULL,
          subcategory TEXT NOT NULL
        )
      `.execute(db)

      await sql`
        CREATE TABLE IF NOT EXISTS components (
          lcsc INTEGER PRIMARY KEY,
          mfr TEXT NOT NULL,
          package TEXT NOT NULL,
          description TEXT NOT NULL,
          stock INTEGER NOT NULL,
          price TEXT NOT NULL,
          extra TEXT,
          basic INTEGER NOT NULL DEFAULT 0,
          preferred INTEGER NOT NULL DEFAULT 0,
          category_id INTEGER NOT NULL,
          manufacturer_id INTEGER NOT NULL,
          datasheet TEXT NOT NULL DEFAULT '',
          flag INTEGER NOT NULL DEFAULT 0,
          joints INTEGER NOT NULL DEFAULT 0,
          last_on_stock INTEGER NOT NULL DEFAULT 0,
          last_update INTEGER NOT NULL DEFAULT 0
        )
      `.execute(db)

      await sql`
        INSERT OR IGNORE INTO manufacturers (id, name)
        VALUES (1, 'Fixture Manufacturer')
      `.execute(db)

      await sql`
        INSERT OR IGNORE INTO categories (id, category, subcategory)
        VALUES
          (1, 'Integrated Circuits', 'Microcontrollers'),
          (2, 'Optoelectronics', 'RGB LEDs(Built-In IC)'),
          (3, 'Audio Products', 'Microphones')
      `.execute(db)

      await sql`
        INSERT OR IGNORE INTO components (
          lcsc,
          mfr,
          package,
          description,
          stock,
          price,
          extra,
          basic,
          preferred,
          category_id,
          manufacturer_id
        )
        VALUES
          (1002, 'NE555DR', 'SOIC-8', '555 Timer precision timer', 5000, '[{"price":"0.10"}]', '{}', 1, 0, 1, 1),
          (11702, '0402WGF5101TCE', '0402', '5.1k resistor 0402 chip resistor', 31485061, '[{"price":"0.001"}]', '{}', 0, 1, 1, 1),
          (965793, 'XL-1608SURC-04', '0402', 'red led 0402 indicator', 120000, '[{"price":"0.002"}]', '{}', 0, 1, 2, 1),
          (2765186, 'USB Type-C 16P', 'USB-C-SMD', 'USB Type-C 16P connector', 4200, '[{"price":"0.08"}]', '{}', 0, 1, 1, 1),
          (40164, 'STM32F401RCT6', 'LQFP-64', 'STM32F401RCT6 microcontroller', 900, '[{"price":"2.50"}]', '{}', 0, 1, 1, 1),
          (81001, 'C0402C104K', '0402', '0.1uf capacitor', 25000, '[{"price":"0.001"}]', '{}', 0, 1, 1, 1)
      `.execute(db)
    }

    await sql`
      CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(
        mfr,
        description,
        lcsc,
        mfr_chars
      )
    `.execute(db)

    if (!(await componentView.checkIfAdded(db))) {
      await componentView.execute(db)
    }
  } finally {
    await db.destroy()
    resetDbClient()
  }
}

await ensureRouteFixtureDatabase()

afterEach(async () => {
  const cleanupFns = [...globalThis.deferredCleanupFns]
  globalThis.deferredCleanupFns.length = 0

  for (let index = cleanupFns.length - 1; index >= 0; index -= 1) {
    const cleanup = cleanupFns[index]
    await cleanup()
  }
})
