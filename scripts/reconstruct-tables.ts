import Database from "better-sqlite3"
import Path from "node:path"

const DB_PATH = Path.join(import.meta.dirname || "", "../db.sqlite3")

function convertPrice(priceStr: string | null): string {
  if (!priceStr) return "[]"
  try {
    const parts = priceStr.split(",")
    const intervals = parts.map((part) => {
      const [range, priceVal] = part.split(":")
      const price = parseFloat(priceVal)
      const [fromStr, toStr] = range.split("-")
      const qFrom = parseInt(fromStr, 10)
      const qTo = toStr ? parseInt(toStr, 10) : null
      return { qFrom, qTo: isNaN(qTo as number) ? null : qTo, price }
    })
    return JSON.stringify(intervals)
  } catch (e) {
    return "[]"
  }
}

function makeExtra(
  jlcAttrs: string | null,
  lcscAttrs: string | null,
  manufacturer: string | null,
  image: string | null,
  urlSlug: string | null,
): string {
  let attrs = {}
  try {
    if (jlcAttrs) attrs = { ...attrs, ...JSON.parse(jlcAttrs) }
  } catch (e) {}
  try {
    if (lcscAttrs) attrs = { ...attrs, ...JSON.parse(lcscAttrs) }
  } catch (e) {}
  return JSON.stringify({
    attributes: attrs,
    manufacturer: manufacturer || "",
    image: image || "",
    images: image ? [image] : [],
    url_slug: urlSlug || "",
  })
}

async function main() {
  console.log(`Opening SQLite database at: ${DB_PATH}`)
  const db = new Database(DB_PATH)

  // Register helper functions
  db.function("convert_price", (priceStr: any) => convertPrice(priceStr))
  db.function(
    "make_extra",
    (jlcAttrs: any, lcscAttrs: any, mfr: any, image: any, slug: any) =>
      makeExtra(jlcAttrs, lcscAttrs, mfr, image, slug),
  )

  console.log("Setting SQLite PRAGMAs for performance...")
  db.exec("PRAGMA journal_mode = OFF;")
  db.exec("PRAGMA synchronous = OFF;")
  db.exec("PRAGMA cache_size = 100000;")

  console.log("Creating temporary indexes on source tables for performance...")
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jlc_components_lcsc ON jlc_components(lcsc);
    CREATE INDEX IF NOT EXISTS idx_lcsc_components_lcsc ON lcsc_components(lcsc);
    CREATE INDEX IF NOT EXISTS idx_jlc_components_mfr ON jlc_components(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_lcsc_components_mfr ON lcsc_components(manufacturer);
    CREATE INDEX IF NOT EXISTS idx_jlc_components_cat_subcat ON jlc_components(category, subcategory);
  `)

  console.log("Reconstructing categories table...")
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_uniq ON categories(category, subcategory);
  `)
  db.exec(`
    INSERT OR IGNORE INTO categories (category, subcategory)
    SELECT DISTINCT category, subcategory FROM jlc_components;
  `)

  console.log("Reconstructing manufacturers table...")
  db.exec(`
    CREATE TABLE IF NOT EXISTS manufacturers (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_manufacturers_uniq ON manufacturers(name);
  `)
  db.exec(`
    INSERT OR IGNORE INTO manufacturers (name)
    SELECT DISTINCT manufacturer FROM jlc_components;
  `)
  db.exec(`
    INSERT OR IGNORE INTO manufacturers (name)
    SELECT DISTINCT manufacturer FROM lcsc_components;
  `)

  console.log("Creating components table schema...")
  db.exec(`
    DROP TABLE IF EXISTS components;
    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY NOT NULL,
      mfr TEXT NOT NULL,
      package TEXT NOT NULL,
      joints INTEGER NOT NULL,
      description TEXT NOT NULL,
      datasheet TEXT NOT NULL,
      stock INTEGER NOT NULL,
      price TEXT NOT NULL,
      extra TEXT,
      basic INTEGER NOT NULL DEFAULT 0,
      preferred INTEGER NOT NULL DEFAULT 0,
      extended_promotional INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER NOT NULL,
      manufacturer_id INTEGER NOT NULL,
      last_on_stock INTEGER NOT NULL DEFAULT 0,
      last_update INTEGER NOT NULL DEFAULT 0,
      flag INTEGER NOT NULL DEFAULT 0
    );
  `)

  console.log("Populating components table (this might take a minute)...")
  db.exec(`
    INSERT INTO components (
      lcsc,
      mfr,
      package,
      joints,
      description,
      datasheet,
      stock,
      price,
      extra,
      basic,
      preferred,
      extended_promotional,
      category_id,
      manufacturer_id,
      last_on_stock,
      last_update,
      flag
    )
    SELECT
      j.lcsc,
      j.mfr,
      j.package,
      j.joints,
      j.description,
      j.datasheet,
      j.stock,
      convert_price(j.price),
      make_extra(j.attributes, l.attributes, COALESCE(l.manufacturer, j.manufacturer), l.image, l.url_slug),
      CASE WHEN j.library_type = 'base' THEN 1 ELSE 0 END,
      j.preferred,
      j.preferred,
      cat.id,
      m.id,
      j.last_on_stock,
      j.fetched_at,
      0
    FROM jlc_components j
    LEFT JOIN lcsc_components l ON j.lcsc = l.lcsc
    LEFT JOIN categories cat ON j.category = cat.category AND j.subcategory = cat.subcategory
    LEFT JOIN manufacturers m ON COALESCE(l.manufacturer, j.manufacturer) = m.name;
  `)

  console.log("Recreating components indexes...")
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_components_category_id ON components(category_id);
    CREATE INDEX IF NOT EXISTS idx_components_manufacturer_id ON components(manufacturer_id);
  `)

  console.log("Reconstructing v_components view...")
  db.exec(`
    DROP VIEW IF EXISTS v_components;
    CREATE VIEW v_components AS
    SELECT
      c.basic,
      cat.category,
      c.category_id,
      c.datasheet,
      c.description,
      c.extra,
      c.joints,
      c.last_on_stock,
      c.lcsc,
      m.name AS manufacturer,
      c.mfr,
      c.package,
      c.preferred,
      c.price,
      c.stock,
      cat.subcategory,
      c.extended_promotional
    FROM components c
    JOIN categories cat ON c.category_id = cat.id
    JOIN manufacturers m ON c.manufacturer_id = m.id;
  `)

  console.log("Reconstruction completed successfully.")
  db.close()
}

main().catch(console.error)
