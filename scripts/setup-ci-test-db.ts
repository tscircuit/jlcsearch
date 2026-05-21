import { Database } from "bun:sqlite"
import { rm } from "node:fs/promises"
import { getResolvedDbPath } from "lib/db/get-db-client"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const dbPath = getResolvedDbPath()

const fixtureComponents = [
  {
    lcsc: 1002,
    mfr: "STM32F401RCT6",
    package: "LQFP-64",
    description: "STM32F401RCT6 ARM Cortex-M4 microcontroller",
    stock: 120,
    price: "2.35",
    basic: 1,
    preferred: 1,
    categoryId: 1,
    category: "Integrated Circuits",
    subcategory: "Microcontrollers",
  },
  {
    lcsc: 11702,
    mfr: "0402 5.1k resistor",
    package: "0402",
    description: "5.1k ohm chip resistor 0402",
    stock: 5000,
    price: "0.001",
    basic: 1,
    preferred: 0,
    categoryId: 2,
    category: "Resistors",
    subcategory: "Chip Resistor - Surface Mount",
  },
  {
    lcsc: 2765186,
    mfr: "USB Type-C 16P",
    package: "SMD",
    description: "USB Type-C connector 16P receptacle",
    stock: 2400,
    price: "0.19",
    basic: 0,
    preferred: 1,
    categoryId: 3,
    category: "Connectors",
    subcategory: "USB Connectors",
  },
  {
    lcsc: 965793,
    mfr: "0402 LED",
    package: "0402",
    description: "red LED 0402 indicator diode",
    stock: 3200,
    price: "0.003",
    basic: 1,
    preferred: 0,
    categoryId: 4,
    category: "Optoelectronics",
    subcategory: "Light Emitting Diodes (LED)",
  },
]

const priceJson = (price: string) => JSON.stringify([{ price }])

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
    mfr TEXT,
    package TEXT,
    description TEXT,
    stock INTEGER,
    price TEXT,
    extra TEXT,
    basic INTEGER,
    preferred INTEGER,
    category_id INTEGER,
    last_on_stock INTEGER
  );

  CREATE VIEW v_components AS
    SELECT
      components.*,
      categories.category,
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

const insertCategory = db.prepare(`
  INSERT INTO categories (id, category, subcategory)
  VALUES (?, ?, ?)
`)

const insertComponent = db.prepare(`
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
    category_id,
    last_on_stock
  )
  VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
  )
`)

const insertFts = db.prepare(`
  INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
  VALUES (?, ?, ?, ?, ?)
`)

const nowSeconds = Math.floor(Date.now() / 1000)

for (const component of fixtureComponents) {
  insertCategory.run(
    component.categoryId,
    component.category,
    component.subcategory,
  )

  insertComponent.run(
    component.lcsc,
    component.mfr,
    component.package,
    component.description,
    component.stock,
    priceJson(component.price),
    JSON.stringify({ attributes: {} }),
    component.basic,
    component.preferred,
    component.categoryId,
    nowSeconds,
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

await setupDerivedTables({
  populate: false,
  resetAll: true,
  logger: console.log,
})

console.log(`Created CI test database at ${dbPath}`)
