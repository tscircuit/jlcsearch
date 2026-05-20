import { Database } from "bun:sqlite"
import { mkdir, rm } from "node:fs/promises"
import Path from "node:path"

const dbPath = process.env.JLCSEARCH_DB_PATH?.trim() || ".tmp/test-db.sqlite3"

await mkdir(Path.dirname(dbPath), { recursive: true })
await rm(dbPath, { force: true })

const db = new Database(dbPath)

db.exec(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL
  );

  CREATE TABLE components (
    lcsc INTEGER PRIMARY KEY,
    mfr TEXT NOT NULL,
    description TEXT NOT NULL,
    package TEXT NOT NULL,
    stock INTEGER NOT NULL,
    price TEXT NOT NULL,
    basic INTEGER NOT NULL DEFAULT 0,
    preferred INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER NOT NULL,
    datasheet TEXT NOT NULL DEFAULT '',
    manufacturer_id INTEGER NOT NULL DEFAULT 0,
    joints INTEGER NOT NULL DEFAULT 0,
    extra TEXT,
    flag INTEGER NOT NULL DEFAULT 0,
    last_on_stock INTEGER NOT NULL DEFAULT 0,
    last_update INTEGER NOT NULL DEFAULT 0
  );

  CREATE VIEW v_components AS
  SELECT
    components.basic,
    categories.category,
    components.category_id,
    components.datasheet,
    components.description,
    components.extra,
    components.joints,
    components.last_on_stock,
    components.lcsc,
    components.mfr AS manufacturer,
    components.mfr,
    components.package,
    components.preferred,
    components.price,
    components.stock,
    categories.subcategory
  FROM components
  LEFT JOIN categories ON categories.id = components.category_id;

  CREATE VIRTUAL TABLE components_fts USING fts5(
    mfr,
    description,
    lcsc,
    mfr_chars
  );
`)

db.prepare(
  "INSERT INTO categories (id, category, subcategory) VALUES (?, ?, ?)",
).run(1, "Semiconductors", "Microcontrollers")

const components = [
  {
    lcsc: 1002,
    mfr: "C1002 diode",
    description: "General purpose switching diode",
    package: "SOD-123",
    stock: 5000,
    price: JSON.stringify([{ price: "0.01" }]),
  },
  {
    lcsc: 11702,
    mfr: "RC0402FR-075K1L",
    description: "0402 5.1k resistor",
    package: "0402",
    stock: 4000,
    price: JSON.stringify([{ price: "0.001" }]),
  },
  {
    lcsc: 965793,
    mfr: "0402 red led",
    description: "Red LED indicator",
    package: "0402",
    stock: 3000,
    price: JSON.stringify([{ price: "0.02" }]),
  },
  {
    lcsc: 2765186,
    mfr: "USB Type-C 16P connector",
    description: "USB Type-C 16P connector receptacle",
    package: "SMD",
    stock: 2000,
    price: JSON.stringify([{ price: "0.12" }]),
  },
  {
    lcsc: 4016,
    mfr: "STM32F401RCT6",
    description: "ARM Cortex-M4 microcontroller",
    package: "LQFP-64",
    stock: 1000,
    price: JSON.stringify([{ price: "3.50" }]),
  },
]

const insertComponent = db.prepare(`
  INSERT INTO components (
    lcsc,
    mfr,
    description,
    package,
    stock,
    price,
    category_id
  ) VALUES (?, ?, ?, ?, ?, ?, 1)
`)

const insertFts = db.prepare(`
  INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
  VALUES (?, ?, ?, ?, ?)
`)

for (const component of components) {
  insertComponent.run(
    component.lcsc,
    component.mfr,
    component.description,
    component.package,
    component.stock,
    component.price,
  )
  insertFts.run(
    component.lcsc,
    component.mfr.toLowerCase(),
    component.description.toLowerCase(),
    String(component.lcsc),
    component.mfr.toLowerCase().split("").join(" "),
  )
}

db.close()
