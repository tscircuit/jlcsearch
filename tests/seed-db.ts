import { Database } from "bun:sqlite"

const db = new Database("db.sqlite3")

// Create components table
db.run(`
  CREATE TABLE IF NOT EXISTS components (
    lcsc INTEGER PRIMARY KEY,
    mfr TEXT,
    description TEXT,
    package TEXT,
    stock INTEGER,
    price TEXT,
    basic INTEGER,
    preferred INTEGER,
    category_id INTEGER,
    manufacturer_id INTEGER,
    last_update INTEGER,
    datasheet TEXT,
    extra TEXT,
    flag INTEGER,
    joints INTEGER,
    last_on_stock INTEGER
  )
`)

// Create categories table
db.run(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    category TEXT,
    subcategory TEXT
  )
`)

// Create v_components view (simplified for mock)
db.run(`
  CREATE VIEW IF NOT EXISTS v_components AS
  SELECT 
    c.*, 
    cat.category, 
    cat.subcategory,
    'Some Manufacturer' as manufacturer
  FROM components c
  LEFT JOIN categories cat ON c.category_id = cat.id
`)

// Create components_fts virtual table
try {
  db.run(`
    CREATE VIRTUAL TABLE components_fts USING fts5(
      mfr,
      description,
      lcsc,
      mfr_chars
    )
  `)
} catch (e: any) {
  console.log(
    "FTS5 table might already exist or FTS5 not supported:",
    e.message,
  )
}

// Insert mock data for tests
const mockComponents = [
  {
    lcsc: 401,
    mfr: "STM32F401RCT6",
    description: "ARM Microcontrollers - MCU 32Bit 84MHz 256KB Flash",
    package: "LQFP-64",
    stock: 1000,
    price: JSON.stringify([{ price: "2.5" }]),
    basic: 1,
    preferred: 1,
  },
  {
    lcsc: 555,
    mfr: "NE555DR",
    description: "555 Timer IC 1-Channel 8-SOIC",
    package: "SOIC-8",
    stock: 5000,
    price: JSON.stringify([{ price: "0.1" }]),
    basic: 1,
    preferred: 1,
  },
  {
    lcsc: 123,
    mfr: "RED-LED-0603",
    description: "Red LED 0603 SMD",
    package: "0603",
    stock: 10000,
    price: JSON.stringify([{ price: "0.01" }]),
    basic: 1,
    preferred: 0,
  },
  {
    lcsc: 1002,
    mfr: "C1002-MFR",
    description: "Some component with LCSC C1002",
    package: "SOD-123",
    stock: 2000,
    price: JSON.stringify([{ price: "0.05" }]),
    basic: 0,
    preferred: 1,
  },
  {
    lcsc: 999,
    mfr: "CAP-0.1UF-50V",
    description: "Capacitor 0.1uF 50V 0402",
    package: "0402",
    stock: 20000,
    price: JSON.stringify([{ price: "0.005" }]),
    basic: 1,
    preferred: 1,
  },
]

const insertComp = db.prepare(`
  INSERT OR REPLACE INTO components (lcsc, mfr, description, package, stock, price, basic, preferred)
  VALUES ($lcsc, $mfr, $description, $package, $stock, $price, $basic, $preferred)
`)

const insertFts = db.prepare(`
  INSERT OR REPLACE INTO components_fts (rowid, mfr, description, lcsc, mfr_chars)
  VALUES ($rowid, $mfr, $description, $lcsc, $mfr_chars)
`)

for (const comp of mockComponents) {
  insertComp.run({
    $lcsc: comp.lcsc,
    $mfr: comp.mfr,
    $description: comp.description,
    $package: comp.package,
    $stock: comp.stock,
    $price: comp.price,
    $basic: comp.basic,
    $preferred: comp.preferred,
  })

  // Get the rowid of the inserted component
  const rowid = (db.query("SELECT last_insert_rowid() as id").get() as any).id

  insertFts.run({
    $rowid: rowid,
    $mfr: comp.mfr.toLowerCase(),
    $description: comp.description.toLowerCase(),
    $lcsc: comp.lcsc.toString().toLowerCase(),
    $mfr_chars: comp.mfr.toLowerCase().split("").join(" "),
  })
}

console.log("Database seeded successfully with mock components.")
