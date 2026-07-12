import { Database } from "bun:sqlite"
import { getResolvedDbPath } from "lib/db/get-db-client"

const componentFixtures = [
  [1002, "TEST-C1002", "generic component", "0603"],
  [11702, "TEST-5K1", "0402 5.1k 1k resistor", "0402"],
  [965793, "TEST-LED", "0402 red led", "0402"],
  [2765186, "TEST-USB-C", "usb type-c 16p connector", "SMD"],
  [3000000, "STM32F401RCT6", "stm32f401rct6 microcontroller", "LQFP-64"],
] as const

export const ensureBaseComponentFixtures = () => {
  const db = new Database(getResolvedDbPath())
  const hasComponents = db
    .query(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'components'",
    )
    .get()

  if (hasComponents) {
    db.close()
    return
  }

  db.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL
    );
    CREATE TABLE manufacturers (
      id INTEGER PRIMARY KEY,
      manufacturer TEXT NOT NULL
    );
    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL,
      manufacturer_id INTEGER NOT NULL,
      mfr TEXT NOT NULL,
      package TEXT NOT NULL,
      joints INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL,
      price TEXT NOT NULL,
      basic INTEGER NOT NULL DEFAULT 0,
      preferred INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      datasheet TEXT NOT NULL DEFAULT '',
      last_update INTEGER NOT NULL DEFAULT 0,
      last_on_stock INTEGER NOT NULL DEFAULT 0,
      flag INTEGER NOT NULL DEFAULT 0,
      extra TEXT
    );
    CREATE VIEW v_components AS
      SELECT
        components.*,
        categories.category,
        categories.subcategory,
        manufacturers.manufacturer
      FROM components
      LEFT JOIN categories ON components.category_id = categories.id
      LEFT JOIN manufacturers ON components.manufacturer_id = manufacturers.id;
    CREATE VIRTUAL TABLE components_fts USING fts5(
      mfr,
      description,
      lcsc,
      mfr_chars
    );
    INSERT INTO categories (id, category, subcategory)
      VALUES (1, 'Test Components', 'Test Components');
    INSERT INTO manufacturers (id, manufacturer)
      VALUES (1, 'Test Manufacturer');
  `)

  const insertComponent = db.prepare(`
    INSERT INTO components (
      lcsc, category_id, manufacturer_id, mfr, package, stock, price,
      description, extra
    ) VALUES (?, 1, 1, ?, ?, 100, '[{"price":0.1}]', ?, '{}')
  `)
  const insertFts = db.prepare(`
    INSERT INTO components_fts (mfr, description, lcsc, mfr_chars)
      VALUES (LOWER(?), LOWER(?), ?, LOWER(?))
  `)

  for (const [lcsc, mfr, description, packageName] of componentFixtures) {
    insertComponent.run(lcsc, mfr, packageName, description)
    insertFts.run(mfr, description, String(lcsc), mfr)
  }

  db.close()
}
