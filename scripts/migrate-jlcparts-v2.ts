import { getBunDatabaseClient } from "../lib/db/get-db-client"

function parsePriceToNewJson(priceStr: string | null): string {
  if (!priceStr) return "[]"
  try {
    const parts = priceStr.split(",")
    const result = parts.map((part) => {
      const [range, priceVal] = part.split(":")
      const [qFromStr, qToStr] = range.split("-")
      const qFrom = parseInt(qFromStr, 10)
      const qTo = qToStr && qToStr.trim() !== "" ? parseInt(qToStr, 10) : null
      const price = parseFloat(priceVal)
      return { qFrom, qTo, price }
    })
    return JSON.stringify(result)
  } catch (e) {
    return "[]"
  }
}

async function main() {
  console.log(
    "Migrating source-db-v2 to components, categories, and manufacturers...",
  )
  const db = getBunDatabaseClient()

  console.log("Creating categories table...")
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL
    );
  `)

  console.log("Populating categories...")
  db.exec(`
    INSERT INTO categories (category, subcategory)
    SELECT DISTINCT category, subcategory FROM jlc_components
    WHERE NOT EXISTS (
      SELECT 1 FROM categories c 
      WHERE c.category = jlc_components.category 
        AND c.subcategory = jlc_components.subcategory
    );
  `)

  console.log("Creating manufacturers table...")
  db.exec(`
    CREATE TABLE IF NOT EXISTS manufacturers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );
  `)

  console.log("Populating manufacturers...")
  db.exec(`
    INSERT INTO manufacturers (name)
    SELECT DISTINCT manufacturer FROM jlc_components
    WHERE NOT EXISTS (
      SELECT 1 FROM manufacturers m 
      WHERE m.name = jlc_components.manufacturer
    );
  `)

  console.log("Creating components table...")
  db.exec(`
    CREATE TABLE IF NOT EXISTS components (
      lcsc INTEGER PRIMARY KEY,
      category_id INTEGER,
      manufacturer_id INTEGER,
      mfr TEXT,
      package TEXT,
      joints INTEGER,
      preferred INTEGER DEFAULT 0,
      basic INTEGER DEFAULT 0,
      last_on_stock INTEGER DEFAULT 0,
      description TEXT,
      datasheet TEXT,
      stock INTEGER DEFAULT 0,
      price TEXT,
      extra TEXT,
      last_update INTEGER,
      flag INTEGER DEFAULT 0
    );
  `)

  console.log("Caching categories and manufacturers in memory...")
  const categoriesMap = new Map<string, number>()
  const categoriesList = db
    .query("SELECT id, category, subcategory FROM categories")
    .all() as any[]
  for (const cat of categoriesList) {
    categoriesMap.set(`${cat.category}\0${cat.subcategory}`, cat.id)
  }

  const manufacturersMap = new Map<string, number>()
  const manufacturersList = db
    .query("SELECT id, name FROM manufacturers")
    .all() as any[]
  for (const mfr of manufacturersList) {
    manufacturersMap.set(mfr.name, mfr.id)
  }

  console.log(
    "Selecting active components from jlc_components joined with lcsc_components...",
  )
  const selectQuery = db.query(`
    SELECT 
      j.lcsc, j.category, j.subcategory, j.mfr, j.package, j.joints, j.manufacturer, j.preferred, 
      j.library_type, j.last_on_stock, j.description, j.datasheet, j.stock, j.price, j.attributes as jlc_attributes,
      l.attributes as lcsc_attributes, j.fetched_at
    FROM jlc_components j
    LEFT JOIN lcsc_components l ON j.lcsc = l.lcsc
    WHERE j.last_on_stock >= strftime('%s', 'now', '-1 year')
  `)

  const componentsToInsert = selectQuery.all() as any[]
  console.log(
    `Fetched ${componentsToInsert.length} active components. Migrating...`,
  )

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO components (
      lcsc, category_id, manufacturer_id, mfr, package, joints, preferred, basic,
      last_on_stock, description, datasheet, stock, price, extra, last_update
    ) VALUES (
      $lcsc, $category_id, $manufacturer_id, $mfr, $package, $joints, $preferred, $basic,
      $last_on_stock, $description, $datasheet, $stock, $price, $extra, $last_update
    )
  `)

  // Run in a transaction
  db.transaction(() => {
    for (const j of componentsToInsert) {
      const categoryId =
        categoriesMap.get(`${j.category}\0${j.subcategory}`) || null
      const manufacturerId = manufacturersMap.get(j.manufacturer) || null
      const basic = j.library_type === "base" ? 1 : 0
      const jlcAttrs = j.jlc_attributes ? JSON.parse(j.jlc_attributes) : {}
      const lcscAttrs = j.lcsc_attributes ? JSON.parse(j.lcsc_attributes) : {}
      const extraJson = JSON.stringify({
        manufacturer: { name: j.manufacturer },
        attributes: { ...jlcAttrs, ...lcscAttrs },
      })
      const priceJson = parsePriceToNewJson(j.price)

      insertStmt.run({
        $lcsc: j.lcsc,
        $category_id: categoryId,
        $manufacturer_id: manufacturerId,
        $mfr: j.mfr,
        $package: j.package,
        $joints: j.joints,
        $preferred: j.preferred,
        $basic: basic,
        $last_on_stock: j.last_on_stock,
        $description: j.description,
        $datasheet: j.datasheet,
        $stock: j.stock,
        $price: priceJson,
        $extra: extraJson,
        $last_update: j.fetched_at,
      })
    }
  })()

  console.log("Creating v_components view...")
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_components AS
    SELECT 
      c.lcsc,
      cat.category,
      cat.subcategory,
      c.category_id,
      c.mfr,
      c.package,
      c.joints,
      m.name AS manufacturer,
      c.preferred,
      c.basic,
      c.last_on_stock,
      c.description,
      c.datasheet,
      c.stock,
      c.price,
      c.extra
    FROM components c
    JOIN categories cat ON c.category_id = cat.id
    JOIN manufacturers m ON c.manufacturer_id = m.id;
  `)

  console.log("Migration complete!")
  db.close()
}

main().catch(console.error)
