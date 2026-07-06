import { Database } from "bun:sqlite"
import { rm } from "node:fs/promises"

if (process.env.CI !== "true") {
  process.exit(1)
}

await rm("db.sqlite3", { force: true })

const db = new Database("db.sqlite3")

db.exec(`
  CREATE TABLE components (
    lcsc INTEGER PRIMARY KEY,
    mfr TEXT NOT NULL,
    package TEXT,
    description TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    price TEXT,
    extra TEXT,
    basic INTEGER NOT NULL DEFAULT 0,
    preferred INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER,
    category TEXT,
    subcategory TEXT
  );

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT
  );

  CREATE VIEW v_components AS
    SELECT * FROM components;

  CREATE VIRTUAL TABLE components_fts USING fts5(
    mfr,
    description,
    lcsc,
    mfr_chars
  );
`)

const components = [
  {
    lcsc: 11702,
    mfr: "RC0402FR-075K1L",
    package: "0402",
    description: "5.1K resistor 0402",
    stock: 12000,
    basic: 0,
    preferred: 1,
  },
  {
    lcsc: 2765186,
    mfr: "USB Type-C 16P connector",
    package: "SMD",
    description: "USB Type-C 16P receptacle connector",
    stock: 8000,
    basic: 1,
    preferred: 1,
  },
  {
    lcsc: 965793,
    mfr: "0402 RED LED",
    package: "0402",
    description: "red led 0402",
    stock: 15000,
    basic: 1,
    preferred: 0,
  },
  {
    lcsc: 1002,
    mfr: "C1002",
    package: "0603",
    description: "test part number C1002",
    stock: 100,
    basic: 0,
    preferred: 0,
  },
  {
    lcsc: 401000,
    mfr: "STM32F401RCT6",
    package: "LQFP-64",
    description: "STM32F401RCT6 microcontroller",
    stock: 500,
    basic: 0,
    preferred: 1,
  },
  {
    lcsc: 555001,
    mfr: "NE555DR",
    package: "SOIC-8",
    description: "555 Timer integrated circuit",
    stock: 250,
    basic: 1,
    preferred: 0,
  },
]

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
    category,
    subcategory
  )
  VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    '[{"price":"0.01"}]',
    '{}',
    ?,
    ?,
    1,
    'Passive Components',
    'Test Components'
  )
`)

const insertFts = db.prepare(`
  INSERT INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
  VALUES (?, ?, ?, ?, ?)
`)

const insertComponents = db.transaction(() => {
  for (const component of components) {
    insertComponent.run(
      component.lcsc,
      component.mfr,
      component.package,
      component.description,
      component.stock,
      component.basic,
      component.preferred,
    )
    insertFts.run(
      component.lcsc,
      component.mfr.toLowerCase(),
      component.description.toLowerCase(),
      String(component.lcsc),
      component.mfr.toLowerCase().split("").join(" "),
    )
  }
})

insertComponents()

db.prepare(
  "INSERT INTO categories (id, category, subcategory) VALUES (1, 'Passive Components', 'Test Components')",
).run()

db.close()

console.log("Created minimal CI db.sqlite3")
