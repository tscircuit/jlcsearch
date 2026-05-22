import { Database } from "bun:sqlite"
import { mkdirSync, rmSync } from "node:fs"
import Path from "node:path"

const dbPath = process.env.JLCSEARCH_DB_PATH ?? ".tmp/test-db.sqlite3"
const resolvedDbPath = Path.resolve(process.cwd(), dbPath)

mkdirSync(Path.dirname(resolvedDbPath), { recursive: true })
rmSync(resolvedDbPath, { force: true })

const db = new Database(resolvedDbPath)

db.exec(`
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL
  );

  CREATE TABLE components (
    lcsc INTEGER PRIMARY KEY,
    mfr TEXT NOT NULL,
    package TEXT NOT NULL,
    description TEXT NOT NULL,
    datasheet TEXT NOT NULL DEFAULT '',
    price TEXT NOT NULL,
    stock INTEGER NOT NULL,
    last_update INTEGER NOT NULL DEFAULT 0,
    manufacturer_id INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER NOT NULL,
    extra TEXT,
    basic INTEGER NOT NULL DEFAULT 0,
    preferred INTEGER NOT NULL DEFAULT 0,
    joints INTEGER NOT NULL DEFAULT 0,
    flag INTEGER NOT NULL DEFAULT 0,
    last_on_stock INTEGER NOT NULL DEFAULT 0
  );

  CREATE VIRTUAL TABLE components_fts USING fts5(
    lcsc,
    mfr,
    mfr_chars,
    description
  );

  CREATE VIEW v_components AS
    SELECT
      components.*,
      categories.category,
      categories.subcategory
    FROM components
    INNER JOIN categories ON categories.id = components.category_id;
`)

const categories = [
  [1, "Integrated Circuits", "ST Microelectronics"],
  [2, "Resistors", "Chip Resistor - Surface Mount"],
  [3, "Connectors", "USB Connectors"],
  [4, "Optoelectronics", "Light Emitting Diodes (LED)"],
  [5, "Integrated Circuits", "Timers"],
] as const

const insertCategory = db.prepare(
  "INSERT INTO categories (id, category, subcategory) VALUES (?, ?, ?)",
)
for (const category of categories) {
  insertCategory.run(...category)
}

type ComponentSeed = {
  lcsc: number
  mfr: string
  package: string
  description: string
  categoryId: number
  basic?: number
  preferred?: number
}

const components: ComponentSeed[] = [
  {
    lcsc: 1002,
    mfr: "C1002 Test Component",
    package: "SOT-23",
    description: "Generic test component for direct LCSC lookup",
    categoryId: 1,
  },
  {
    lcsc: 11702,
    mfr: "RC0402FR-075K1L",
    package: "0402",
    description: "0402 5.1k resistor",
    categoryId: 2,
    preferred: 1,
  },
  {
    lcsc: 2765186,
    mfr: "USB Type-C 16P Connector",
    package: "SMD",
    description: "USB Type-C 16P connector receptacle",
    categoryId: 3,
  },
  {
    lcsc: 965793,
    mfr: "Red LED 0402",
    package: "0402",
    description: "0402 red LED indicator",
    categoryId: 4,
  },
  {
    lcsc: 40164,
    mfr: "STM32F401RCT6 STMicroelectronics",
    package: "LQFP-64",
    description: "STM32F401RCT6 ARM Cortex-M4 microcontroller",
    categoryId: 1,
    preferred: 1,
  },
  {
    lcsc: 555001,
    mfr: "NE555 Timer",
    package: "SOIC-8",
    description: "555 Timer integrated circuit",
    categoryId: 5,
    basic: 1,
  },
]

const price = JSON.stringify([{ qty: 1, price: "0.01" }])
const insertComponent = db.prepare(`
  INSERT INTO components (
    lcsc,
    mfr,
    package,
    description,
    datasheet,
    price,
    stock,
    category_id,
    extra,
    basic,
    preferred
  )
  VALUES (?, ?, ?, ?, '', ?, 100, ?, '{}', ?, ?)
`)
const insertFts = db.prepare(`
  INSERT INTO components_fts (lcsc, mfr, mfr_chars, description)
  VALUES (?, ?, ?, ?)
`)

for (const component of components) {
  insertComponent.run(
    component.lcsc,
    component.mfr,
    component.package,
    component.description,
    price,
    component.categoryId,
    component.basic ?? 0,
    component.preferred ?? 0,
  )
  insertFts.run(
    String(component.lcsc),
    component.mfr,
    component.mfr.replace(/\s+/g, ""),
    component.description,
  )
}

db.close()
console.log(`Created test database at ${resolvedDbPath}`)
