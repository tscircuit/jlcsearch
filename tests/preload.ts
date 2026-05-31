import { afterEach } from "bun:test"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { getBunDatabaseClient } from "lib/db/get-db-client"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []
globalThis.derivedTablesSetupPromise ??= setupDerivedTables({ populate: false })

await globalThis.derivedTablesSetupPromise

const bunDb = getBunDatabaseClient()
bunDb.exec(`
  CREATE TABLE IF NOT EXISTS components (
    lcsc INTEGER PRIMARY KEY,
    category_id INTEGER,
    manufacturer_id INTEGER,
    mfr TEXT,
    package TEXT,
    description TEXT,
    datasheet TEXT,
    stock INTEGER,
    price TEXT,
    extra TEXT,
    joints INTEGER,
    basic INTEGER DEFAULT 0,
    preferred INTEGER DEFAULT 0,
    is_extended_promotional INTEGER DEFAULT 0,
    flag INTEGER DEFAULT 0,
    last_on_stock INTEGER DEFAULT 0,
    last_update INTEGER DEFAULT 0
  )
`)
bunDb.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    subcategory TEXT
  )
`)
bunDb.exec(`
  CREATE VIEW IF NOT EXISTS v_components AS
  SELECT
    c.lcsc,
    c.mfr,
    c.package,
    c.description,
    c.stock,
    c.price,
    c.extra,
    c.basic,
    c.preferred,
    c.is_extended_promotional,
    c.joints,
    c.datasheet,
    c.last_on_stock,
    c.manufacturer_id AS manufacturer,
    c.category_id,
    cat.category,
    cat.subcategory
  FROM components c
  LEFT JOIN categories cat ON c.category_id = cat.id
`)
bunDb.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS components_fts USING fts5(
    mfr,
    description,
    lcsc,
    mfr_chars,
    content='',
    content_rowid='rowid'
  )
`)
bunDb.exec(`
  INSERT OR IGNORE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id)
  VALUES
    (1002, 'Test MFR 1002', 'SOT-23', 'Test component 1002', 1000, '[{"qty":1,"price":"0.10"}]', 1, 1, NULL)
`)
bunDb.exec(`
  INSERT OR IGNORE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id)
  VALUES
    (11702, 'Test Resistor MFR', '0402', '5.1k resistor 0402 1%', 1000, '[{"qty":1,"price":"0.01"}]', 1, 1, NULL)
`)
bunDb.exec(`
  INSERT OR IGNORE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id)
  VALUES
    (2765186, 'Test USB-C MFR', 'USB-C-16P', 'USB Type-C 16P Connector', 1000, '[{"qty":1,"price":"0.50"}]', 1, 1, NULL)
`)
bunDb.exec(`
  INSERT OR IGNORE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id)
  VALUES
    (965793, 'Test LED MFR', '0402', '0402 LED Red', 1000, '[{"qty":1,"price":"0.05"}]', 1, 1, NULL)
`)
bunDb.exec(`
  INSERT OR REPLACE INTO components (lcsc, mfr, package, description, stock, price, basic, preferred, category_id)
  VALUES
    (99999, 'STM32F401RCT6 TR', 'LQFP-64', 'MCU STM32F401RCT6 ARM Cortex-M4', 1000, '[{"qty":1,"price":"2.50"}]', 1, 1, NULL)
`)
bunDb.exec(`
  INSERT OR IGNORE INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
  VALUES
    (1002, 'Test MFR 1002', 'Test component 1002', '1002', 'Test MFR 1002'),
    (11702, 'Test Resistor MFR', '5.1k resistor 0402 1%', '11702', 'Test Resistor MFR'),
    (2765186, 'Test USB-C MFR', 'USB Type-C 16P Connector', '2765186', 'Test USB-C MFR'),
    (965793, 'Test LED MFR', '0402 LED Red', '965793', 'Test LED MFR'),
    (99999, 'STM32F401RCT6 TR', 'MCU STM32F401RCT6 ARM Cortex-M4', '99999', 'STM32F401RCT6 TR')
`)
bunDb.close()

afterEach(async () => {
  const cleanupFns = [...globalThis.deferredCleanupFns]
  globalThis.deferredCleanupFns.length = 0

  for (let index = cleanupFns.length - 1; index >= 0; index -= 1) {
    const cleanup = cleanupFns[index]
    await cleanup()
  }
})

export {}
