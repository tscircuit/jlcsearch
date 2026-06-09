import { afterEach } from "bun:test"
import { sql } from "kysely"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { getDbClient, resetDbClient } from "lib/db/get-db-client"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []
globalThis.derivedTablesSetupPromise ??= setupDerivedTables({
  db: getDbClient(),
  populate: false,
})

await globalThis.derivedTablesSetupPromise

const ensureRouteFixtureDatabase = async () => {
  const db = getDbClient()
  try {
    let hasIsExtendedPromotional = false
    try {
      const info = await sql<{
        name: string
      }>`PRAGMA table_info(components)`.execute(db)
      hasIsExtendedPromotional = info.rows.some(
        (row: any) => row.name === "is_extended_promotional",
      )
    } catch (e) {}

    const requiredTables = await sql<{ name: string }>`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('components', 'categories')
    `.execute(db)

    if (requiredTables.rows.length !== 2 || !hasIsExtendedPromotional) {
      await sql`DROP TABLE IF EXISTS components`.execute(db)
      await sql`DROP TABLE IF EXISTS categories`.execute(db)
      await sql`DROP VIEW IF EXISTS v_components`.execute(db)

      await sql`
        CREATE TABLE categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          subcategory TEXT NOT NULL
        )
      `.execute(db)

      await sql`
        CREATE TABLE components (
          lcsc INTEGER PRIMARY KEY,
          mfr TEXT NOT NULL,
          package TEXT NOT NULL,
          description TEXT NOT NULL,
          stock INTEGER NOT NULL,
          price TEXT NOT NULL,
          extra TEXT,
          basic INTEGER NOT NULL DEFAULT 0,
          preferred INTEGER NOT NULL DEFAULT 0,
          is_extended_promotional INTEGER DEFAULT 0,
          category_id INTEGER NOT NULL,
          manufacturer TEXT NOT NULL DEFAULT '',
          manufacturer_id INTEGER NOT NULL DEFAULT 1,
          datasheet TEXT NOT NULL DEFAULT '',
          flag INTEGER NOT NULL DEFAULT 0,
          joints INTEGER NOT NULL DEFAULT 0,
          last_on_stock INTEGER NOT NULL DEFAULT 0,
          last_update INTEGER NOT NULL DEFAULT 0
        )
      `.execute(db)

      await sql`
        INSERT INTO categories (id, category, subcategory)
        VALUES
          (1, 'Integrated Circuits', 'Microcontrollers'),
          (2, 'Optoelectronics', 'RGB LEDs(Built-In IC)'),
          (3, 'Audio Products', 'Microphones')
      `.execute(db)

      await sql`
        INSERT INTO components (
          lcsc,
          mfr,
          package,
          description,
          stock,
          price,
          extra,
          basic,
          preferred,
          is_extended_promotional,
          category_id,
          manufacturer
        )
        VALUES
          (1002, 'NE555DR', 'SOIC-8', '555 Timer precision timer', 5000, '[{"price":"0.10"}]', '{}', 1, 0, 0, 1, 'Fixture Manufacturer'),
          (11702, '0402WGF5101TCE', '0402', '5.1k resistor 0402 chip resistor', 31485061, '[{"price":"0.001"}]', '{}', 0, 1, 0, 1, 'Fixture Manufacturer'),
          (965793, 'XL-1608SURC-04', '0402', 'red led 0402 indicator', 120000, '[{"price":"0.002"}]', '{}', 0, 1, 0, 2, 'Fixture Manufacturer'),
          (2765186, 'USB Type-C 16P', 'USB-C-SMD', 'USB Type-C 16P connector', 4200, '[{"price":"0.08"}]', '{}', 0, 1, 0, 1, 'Fixture Manufacturer'),
          (40164, 'STM32F401RCT6', 'LQFP-64', 'STM32F401RCT6 microcontroller', 900, '[{"price":"2.50"}]', '{"is_extended_promotional": true}', 0, 1, 1, 1, 'Fixture Manufacturer'),
          (81001, 'C0402C104K', '0402', '0.1uf capacitor', 25000, '[{"price":"0.001"}]', '{}', 0, 1, 0, 1, 'Fixture Manufacturer')
      `.execute(db)
    }

    // Create FTS index for search tests
    await sql`
      CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(
        mfr,
        description,
        lcsc,
        mfr_chars
      )
    `.execute(db)

    // Populate FTS with fixture data
    const ftsCount = await sql<{ cnt: number }>`
      SELECT COUNT(*) AS cnt FROM components_fts
    `.execute(db)

    if (ftsCount.rows[0].cnt === 0) {
      await sql`
        INSERT INTO components_fts (mfr, description, lcsc, mfr_chars)
        SELECT mfr, description, CAST(lcsc AS TEXT), mfr FROM components
      `.execute(db)
    }

    // Create v_components view if it doesn't exist
    const viewExists = await sql`
      SELECT name FROM sqlite_master
      WHERE type='view' AND name='v_components'
    `.execute(db)

    if (viewExists.rows.length === 0) {
      await sql`
        CREATE VIEW v_components AS
        SELECT
          c.basic,
          cat.category,
          c.category_id,
          c.datasheet,
          c.description,
          c.extra,
          c.joints,
          c.last_on_stock,
          c.lcsc,
          c.manufacturer,
          c.mfr,
          c.package,
          c.preferred,
          c.price,
          c.stock,
          cat.subcategory,
          c.is_extended_promotional
        FROM components c
        LEFT JOIN categories cat ON c.category_id = cat.id
      `.execute(db)
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
