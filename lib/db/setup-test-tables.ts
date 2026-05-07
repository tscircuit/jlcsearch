import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"
import { getDbClient } from "lib/db/get-db-client"

export const setupTestTables = async (db?: KyselyDatabaseInstance) => {
  const activeDb = db ?? getDbClient()

  // Create raw tables needed by routes that query components directly
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL
    )
  `.execute(activeDb)

  await sql`
    CREATE TABLE IF NOT EXISTS manufacturers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `.execute(activeDb)

  await sql`
    CREATE TABLE IF NOT EXISTS components (
      lcsc INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL DEFAULT 0,
      manufacturer_id INTEGER NOT NULL DEFAULT 0,
      mfr TEXT NOT NULL DEFAULT '',
      package TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      datasheet TEXT NOT NULL DEFAULT '',
      extra TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      price TEXT NOT NULL DEFAULT '[]',
      basic INTEGER NOT NULL DEFAULT 0,
      preferred INTEGER NOT NULL DEFAULT 0,
      flag INTEGER NOT NULL DEFAULT 0,
      joints INTEGER NOT NULL DEFAULT 0,
      last_on_stock INTEGER NOT NULL DEFAULT 0,
      last_update INTEGER NOT NULL DEFAULT 0
    )
  `.execute(activeDb)

  await sql`
    CREATE VIEW IF NOT EXISTS v_components AS
      SELECT
        c.lcsc,
        c.mfr,
        c.package,
        c.description,
        c.datasheet,
        c.extra,
        c.stock,
        c.price,
        c.basic,
        c.preferred,
        c.joints,
        c.last_on_stock,
        c.category_id,
        cat.category,
        cat.subcategory,
        m.name AS manufacturer
      FROM components c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
  `.execute(activeDb)

  // FTS table for component search
  const ftsExists = await sql`
    SELECT name FROM sqlite_master WHERE type='table' AND name='components_fts'
  `.execute(activeDb)

  if (ftsExists.rows.length === 0) {
    await sql`
      CREATE VIRTUAL TABLE components_fts USING fts5(
        mfr,
        description,
        lcsc UNINDEXED,
        mfr_chars
      )
    `.execute(activeDb)

    await sql`
      CREATE TRIGGER IF NOT EXISTS components_ai AFTER INSERT ON components
      BEGIN
        INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
        VALUES (new.rowid, LOWER(new.mfr), LOWER(new.description), LOWER(new.lcsc), LOWER(new.mfr));
      END
    `.execute(activeDb)

    await sql`
      CREATE TRIGGER IF NOT EXISTS components_ad AFTER DELETE ON components
      BEGIN
        DELETE FROM components_fts WHERE rowid = old.rowid;
      END
    `.execute(activeDb)
  }

  // Seed minimal test data for search tests
  const count = await sql`SELECT COUNT(*) as n FROM components`.execute(activeDb)
  if ((count.rows[0] as any).n === 0) {
    const testComponents = [
      { lcsc: 1002, mfr: "TestComponent", package: "SOIC-8", description: "Test part LCSC1002", stock: 100 },
      { lcsc: 11702, mfr: "RC0402FR-075K1L", package: "0402", description: "5.1kohm 1pct 0402 Resistor", stock: 1000 },
      { lcsc: 2765186, mfr: "TYPE-C-31-M-12", package: "SMD", description: "USB Type-C 16P Connector", stock: 500 },
      { lcsc: 965793, mfr: "KT-0603R", package: "0402", description: "0402 Red LED 620nm", stock: 2000 },
      { lcsc: 999001, mfr: "STM32F401RCT6", package: "LQFP-64", description: "STM32F401RCT6 ARM Cortex MCU", stock: 300 },
    ]

    for (const c of testComponents) {
      await sql`
        INSERT OR IGNORE INTO components (lcsc, mfr, package, description, stock)
        VALUES (${c.lcsc}, ${c.mfr}, ${c.package}, ${c.description}, ${c.stock})
      `.execute(activeDb)
    }
  }
}
