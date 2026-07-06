import { Database } from "bun:sqlite"
import { mkdirSync, rmSync } from "node:fs"
import Path from "node:path"

const TEST_DB_PATH = Path.join(import.meta.dir, "../../.tmp/test-db.sqlite3")

const price = JSON.stringify([{ qFrom: 1, qTo: null, price: 0.01 }])

const components = [
  {
    lcsc: 1002,
    mfr: "NE555P",
    description: "555 Timer DIP-8",
    package: "DIP-8",
    category_id: 1,
    basic: 1,
    preferred: 1,
    stock: 500,
  },
  {
    lcsc: 11702,
    mfr: "RC0402FR-075K1L",
    description: "0402 5.1k resistor",
    package: "0402",
    category_id: 2,
    basic: 0,
    preferred: 1,
    stock: 400,
  },
  {
    lcsc: 965793,
    mfr: "XL-1608SURC",
    description: "0402 red LED",
    package: "0402",
    category_id: 3,
    basic: 0,
    preferred: 1,
    stock: 300,
  },
  {
    lcsc: 2765186,
    mfr: "TYPE-C-16P",
    description: "USB Type-C 16P connector",
    package: "SMD",
    category_id: 4,
    basic: 1,
    preferred: 1,
    stock: 200,
  },
  {
    lcsc: 40164,
    mfr: "STM32F401RCT6",
    description: "ARM Cortex-M4 microcontroller STM32F401RCT6",
    package: "LQFP-64",
    category_id: 1,
    basic: 0,
    preferred: 1,
    stock: 100,
  },
  {
    lcsc: 700001,
    mfr: "MEMS-MIC",
    description: "MEMS Microphone",
    package: "SMD",
    category_id: 5,
    basic: 0,
    preferred: 1,
    stock: 90,
  },
]

export const setupTestDatabase = () => {
  if (process.env.JLCSEARCH_DB_PATH) return

  mkdirSync(Path.dirname(TEST_DB_PATH), { recursive: true })
  rmSync(TEST_DB_PATH, { force: true })
  process.env.JLCSEARCH_DB_PATH = TEST_DB_PATH

  const db = new Database(TEST_DB_PATH)

  db.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL
    );

    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY,
      mfr TEXT NOT NULL,
      manufacturer_id INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER NOT NULL,
      package TEXT NOT NULL,
      joints INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      price TEXT NOT NULL,
      basic INTEGER NOT NULL DEFAULT 0,
      preferred INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      datasheet TEXT NOT NULL DEFAULT '',
      extra TEXT,
      last_update INTEGER NOT NULL DEFAULT 0,
      last_on_stock INTEGER NOT NULL DEFAULT 0,
      flag INTEGER NOT NULL DEFAULT 0
    );

    CREATE VIEW v_components AS
      SELECT
        components.lcsc,
        components.mfr,
        components.mfr AS manufacturer,
        components.manufacturer_id,
        components.category_id,
        categories.category,
        categories.subcategory,
        components.package,
        components.joints,
        components.stock,
        components.price,
        components.basic,
        components.preferred,
        components.description,
        components.datasheet,
        components.extra,
        components.last_on_stock
      FROM components
      LEFT JOIN categories ON categories.id = components.category_id;

    CREATE VIRTUAL TABLE components_fts USING fts5(
      lcsc UNINDEXED,
      mfr,
      description,
      mfr_chars
    );
  `)

  const insertCategory = db.prepare(
    "INSERT INTO categories (id, category, subcategory) VALUES (?, ?, ?)",
  )
  insertCategory.run(1, "Integrated Circuits", "Microcontrollers")
  insertCategory.run(2, "Resistors", "Chip Resistor - Surface Mount")
  insertCategory.run(3, "Optoelectronics", "Light Emitting Diodes (LED)")
  insertCategory.run(4, "Connectors", "USB Connectors")
  insertCategory.run(5, "Audio Products", "MEMS Microphones")

  const insertComponent = db.prepare(`
    INSERT INTO components (
      lcsc,
      mfr,
      category_id,
      package,
      stock,
      price,
      basic,
      preferred,
      description,
      extra
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertFts = db.prepare(
    "INSERT INTO components_fts (lcsc, mfr, description, mfr_chars) VALUES (?, ?, ?, ?)",
  )

  for (const component of components) {
    insertComponent.run(
      component.lcsc,
      component.mfr,
      component.category_id,
      component.package,
      component.stock,
      price,
      component.basic,
      component.preferred,
      component.description,
      component.description,
    )
    insertFts.run(
      component.lcsc.toString(),
      component.mfr,
      component.description,
      component.mfr,
    )
  }

  db.close()
}
