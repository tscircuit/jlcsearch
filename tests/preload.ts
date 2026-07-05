import { afterEach } from "bun:test"
import { sql } from "kysely"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { getDbClient } from "lib/db/get-db-client"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

const TEST_COMPONENTS = [
  {
    lcsc: 45678,
    mfr: "STM32F401RCT6",
    package: "LQFP-64(10x10)",
    description: "STM32F401RCT6 ARM Cortex-M4 microcontroller",
    stock: 500,
    price: '[{"qFrom":1,"price":3.5}]',
  },
  {
    lcsc: 1002,
    mfr: "CL21B104KBCNNNC",
    package: "0805",
    description: "100nF 50V X7R capacitor 0805",
    stock: 10000,
    price: '[{"qFrom":1,"price":0.01}]',
  },
  {
    lcsc: 11702,
    mfr: "RC0402FR-075K1L",
    package: "0402",
    description: "5.1k 1% resistor 0402 thick film",
    stock: 50000,
    price: '[{"qFrom":1,"price":0.001}]',
  },
  {
    lcsc: 2765186,
    mfr: "TYPE-C-31-M-12",
    package: "SMD",
    description: "USB Type-C 16P female connector SMD",
    stock: 2000,
    price: '[{"qFrom":1,"price":0.2}]',
  },
  {
    lcsc: 965793,
    mfr: "NCD0402R1",
    package: "0402",
    description: "Red LED 0402 SMD 630nm",
    stock: 30000,
    price: '[{"qFrom":1,"price":0.005}]',
  },
]

const TEST_FTS_ENTRIES = [
  {
    mfr: "stm32f401rct6",
    description: "stm32f401rct6 arm cortex m4 microcontroller",
    lcsc: "45678",
    mfr_chars: "stm32f401rct6",
  },
  {
    mfr: "cl21b104kbcnnnc",
    description: "100nf 50v x7r capacitor 0805",
    lcsc: "1002",
    mfr_chars: "cl21b104kbcnnnc",
  },
  {
    mfr: "rc0402fr-075k1l",
    description: "5.1k 1 resistor 0402 thick film",
    lcsc: "11702",
    mfr_chars: "rc0402fr075k1l",
  },
  {
    mfr: "type-c-31-m-12",
    description: "usb type-c 16p female connector smd",
    lcsc: "2765186",
    mfr_chars: "typec31m12",
  },
  {
    mfr: "ncd0402r1",
    description: "led 0402 red smd 630nm",
    lcsc: "965793",
    mfr_chars: "ncd0402r1",
  },
]

const setupBaseTablesIfMissing = async () => {
  const db = getDbClient()

  const tableExists = async (name: string) => {
    const result =
      await sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${name}`.execute(
        db,
      )
    return result.rows.length > 0
  }

  const viewExists = async (name: string) => {
    const result =
      await sql`SELECT name FROM sqlite_master WHERE type='view' AND name=${name}`.execute(
        db,
      )
    return result.rows.length > 0
  }

  if (!(await tableExists("categories"))) {
    await sql`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL
      )
    `.execute(db)
  }

  if (!(await tableExists("components"))) {
    await sql`
      CREATE TABLE components (
        lcsc INTEGER PRIMARY KEY,
        category_id INTEGER,
        mfr TEXT NOT NULL,
        package TEXT NOT NULL,
        joints INTEGER NOT NULL DEFAULT 0,
        manufacturer_id INTEGER NOT NULL DEFAULT 1,
        basic INTEGER NOT NULL DEFAULT 0,
        preferred INTEGER NOT NULL DEFAULT 0,
        is_extended_promotional INTEGER NOT NULL DEFAULT 0,
        last_on_stock INTEGER NOT NULL DEFAULT 0,
        flag INTEGER NOT NULL DEFAULT 0,
        last_update INTEGER NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        datasheet TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        price TEXT NOT NULL DEFAULT '[]',
        extra TEXT
      )
    `.execute(db)
  }

  // Seed components that are missing (idempotent via INSERT OR IGNORE)
  for (const c of TEST_COMPONENTS) {
    await sql`
      INSERT OR IGNORE INTO components
        (lcsc, mfr, package, description, stock, price,
         category_id, manufacturer_id, joints, basic, preferred,
         is_extended_promotional, last_on_stock, flag, last_update, datasheet, extra)
      VALUES
        (${c.lcsc}, ${c.mfr}, ${c.package}, ${c.description}, ${c.stock}, ${c.price},
         1, 1, 4, 0, 0, 0, 0, 0, 1700000000, '', NULL)
    `.execute(db)
  }

  if (!(await viewExists("v_components"))) {
    await sql`
      CREATE VIEW v_components AS
        SELECT
          c.lcsc,
          c.mfr,
          c.package,
          c.joints,
          c.description,
          c.datasheet,
          c.stock,
          c.price,
          c.extra,
          c.basic,
          c.preferred,
          c.is_extended_promotional,
          c.last_on_stock,
          cat.category,
          cat.id AS category_id,
          cat.subcategory
        FROM components c
        LEFT JOIN categories cat ON c.category_id = cat.id
    `.execute(db)
  }

  if (!(await tableExists("components_fts"))) {
    await sql`
      CREATE VIRTUAL TABLE components_fts USING fts5(
        mfr,
        description,
        lcsc,
        mfr_chars
      )
    `.execute(db)
  }

  // Seed FTS entries for missing components (check by lcsc)
  for (const entry of TEST_FTS_ENTRIES) {
    const existing = await sql`
      SELECT lcsc FROM components_fts WHERE lcsc = ${entry.lcsc}
    `.execute(db)
    if (existing.rows.length === 0) {
      await sql`
        INSERT INTO components_fts (mfr, description, lcsc, mfr_chars)
        VALUES (${entry.mfr}, ${entry.description}, ${entry.lcsc}, ${entry.mfr_chars})
      `.execute(db)
    }
  }
}

globalThis.deferredCleanupFns ??= []
globalThis.derivedTablesSetupPromise ??= setupDerivedTables({
  populate: false,
}).then(() => setupBaseTablesIfMissing())

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
