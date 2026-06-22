import { afterEach } from "bun:test"
import { getBunDatabaseClient } from "lib/db/get-db-client"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []

const ensureBaseFixtureTables = () => {
  const db = getBunDatabaseClient()

  try {
    const hasComponents = db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'components'",
      )
      .get()
    const hasCategories = db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'categories'",
      )
      .get()

    if (hasComponents && hasCategories) {
      return
    }

    db.exec(`
      DROP TRIGGER IF EXISTS components_ai;
      DROP TRIGGER IF EXISTS components_au;
      DROP TRIGGER IF EXISTS components_ad;
      DROP TABLE IF EXISTS components_fts;
      DROP VIEW IF EXISTS v_components;
      DROP TABLE IF EXISTS components;
      DROP TABLE IF EXISTS categories;

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY,
        category TEXT,
        subcategory TEXT
      );

      CREATE TABLE components (
        lcsc INTEGER PRIMARY KEY,
        mfr TEXT,
        package TEXT,
        description TEXT,
        stock INTEGER,
        price TEXT,
        extra TEXT,
        basic INTEGER DEFAULT 0,
        preferred INTEGER DEFAULT 0,
        is_extended_promotional INTEGER DEFAULT 0,
        category_id INTEGER
      );

      INSERT INTO categories (id, category, subcategory) VALUES
        (1, 'Integrated Circuits', 'Microcontrollers'),
        (2, 'Passives', 'Resistors'),
        (3, 'Connectors', 'USB Connectors'),
        (4, 'Optoelectronics', 'Light Emitting Diodes (LED)');

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
        category_id
      ) VALUES
        (1002, 'NE555DR', 'SOIC-8', '555 Timer IC', 1200, '[{"price":0.05}]', '{"attributes":{}}', 1, 0, 0, 1),
        (11702, '0402WGF5101TCE', '0402', '5.1k resistor 0402 1%', 3000, '[{"price":0.001}]', '{"attributes":{}}', 1, 1, 1, 2),
        (965793, 'LED0402-RED', '0402', 'red LED 0402', 2500, '[{"price":0.002}]', '{"attributes":{}}', 0, 1, 1, 4),
        (2765186, 'TYPE-C-16P', 'SMD', 'USB Type-C 16P connector', 800, '[{"price":0.12}]', '{"attributes":{}}', 0, 1, 1, 3),
        (401001, 'STM32F401RCT6', 'LQFP-64', 'STM32F401RCT6 ARM microcontroller', 500, '[{"price":2.4}]', '{"attributes":{}}', 0, 1, 1, 1),
        (555001, 'TLC555IDR', 'SOIC-8', '555 Timer CMOS IC', 700, '[{"price":0.08}]', '{"attributes":{}}', 0, 0, 0, 1),
        (101001, 'CL05B104KO5NNNC', '0402', '0.1uF ceramic capacitor', 2000, '[{"price":0.001}]', '{"attributes":{}}', 1, 0, 0, 2);

      CREATE VIEW v_components AS
      SELECT
        components.*,
        categories.category,
        categories.subcategory
      FROM components
      LEFT JOIN categories ON components.category_id = categories.id;

      CREATE VIRTUAL TABLE components_fts USING fts5(
        mfr,
        description,
        lcsc,
        mfr_chars
      );

      INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
      SELECT
        rowid,
        LOWER(mfr),
        LOWER(description),
        LOWER(lcsc),
        REPLACE(LOWER(mfr), '', ' ')
      FROM components;
    `)
  } finally {
    db.close()
  }
}

ensureBaseFixtureTables()

globalThis.derivedTablesSetupPromise ??= setupDerivedTables({ populate: false })

await globalThis.derivedTablesSetupPromise

afterEach(async () => {
  const cleanupFns = [...globalThis.deferredCleanupFns]
  globalThis.deferredCleanupFns.length = 0

  for (let index = cleanupFns.length - 1; index >= 0; index -= 1) {
    const cleanup = cleanupFns[index]
    await cleanup()
  }
})

export {}
