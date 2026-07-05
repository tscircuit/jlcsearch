import { Database } from "bun:sqlite"

const dbPath = process.env.JLCSEARCH_DB_PATH?.trim() || "./db.sqlite3"
const db = new Database(dbPath)

const sourceObjectExists = (name: string) =>
  Boolean(
    db
      .query(
        "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1",
      )
      .get(name),
  )

const closeAndThrow = (message: string): never => {
  db.close()
  throw new Error(message)
}

const hasCompleteLegacySchema =
  sourceObjectExists("components") &&
  sourceObjectExists("categories") &&
  sourceObjectExists("manufacturers") &&
  sourceObjectExists("v_components")

if (hasCompleteLegacySchema) {
  console.log("Source database already has jlcsearch tables")
  db.close()
  process.exit(0)
}

if (!sourceObjectExists("jlc_components")) {
  closeAndThrow(
    "Source database does not contain a complete legacy schema or jlc_components table",
  )
}

if (!sourceObjectExists("lcsc_components")) {
  db.exec(`
    CREATE TEMP TABLE lcsc_components (
      lcsc INTEGER,
      manufacturer TEXT,
      attributes TEXT,
      image TEXT,
      url_slug TEXT
    );
  `)
}

console.log("Preparing jlcparts source database for jlcsearch")

db.exec(`
  PRAGMA foreign_keys = OFF;
  PRAGMA synchronous = OFF;
  PRAGMA temp_store = MEMORY;

  DROP TRIGGER IF EXISTS components_ai;
  DROP TRIGGER IF EXISTS components_au;
  DROP TRIGGER IF EXISTS components_ad;
  DROP VIEW IF EXISTS v_components;
  DROP TABLE IF EXISTS components_fts;
  DROP TABLE IF EXISTS components;
  DROP TABLE IF EXISTS categories;
  DROP TABLE IF EXISTS manufacturers;

  CREATE TABLE categories (
    id INTEGER PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    UNIQUE(category, subcategory)
  );

  CREATE TABLE manufacturers (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE components (
    lcsc INTEGER PRIMARY KEY NOT NULL,
    category_id INTEGER NOT NULL,
    mfr TEXT NOT NULL,
    package TEXT NOT NULL,
    joints INTEGER NOT NULL,
    manufacturer_id INTEGER NOT NULL,
    basic INTEGER NOT NULL,
    preferred INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    datasheet TEXT NOT NULL,
    stock INTEGER NOT NULL,
    price TEXT NOT NULL,
    last_update INTEGER NOT NULL,
    extra TEXT,
    flag INTEGER NOT NULL DEFAULT 0,
    last_on_stock INTEGER NOT NULL DEFAULT 0
  );

  INSERT INTO categories (category, subcategory)
  SELECT category, subcategory
  FROM (
    SELECT DISTINCT
      CASE
        WHEN trim(COALESCE(category, '')) = '' THEN 'Uncategorized'
        ELSE category
      END AS category,
      CASE
        WHEN trim(COALESCE(subcategory, '')) = '' THEN 'Uncategorized'
        ELSE subcategory
      END AS subcategory
    FROM jlc_components
    WHERE present = 1
  )
  ORDER BY category, subcategory;

  INSERT INTO manufacturers (name)
  SELECT name
  FROM (
    SELECT DISTINCT
      COALESCE(NULLIF(j.manufacturer, ''), NULLIF(l.manufacturer, ''), '') AS name
    FROM jlc_components j
    LEFT JOIN lcsc_components l ON l.lcsc = j.lcsc
    WHERE j.present = 1
  )
  ORDER BY name;

  WITH source_components AS (
    SELECT
      j.*,
      l.manufacturer AS lcsc_manufacturer,
      l.attributes AS lcsc_attributes,
      l.image AS lcsc_image,
      l.url_slug AS lcsc_url_slug,
      CASE
        WHEN instr(j.price, ',') > 0 THEN substr(j.price, 1, instr(j.price, ',') - 1)
        ELSE j.price
      END AS first_price
    FROM jlc_components j
    LEFT JOIN lcsc_components l ON l.lcsc = j.lcsc
    WHERE j.present = 1
  ),
  price_parts AS (
    SELECT
      *,
      CASE
        WHEN instr(first_price, ':') > 0 THEN substr(first_price, 1, instr(first_price, ':') - 1)
        ELSE ''
      END AS price_range,
      CASE
        WHEN instr(first_price, ':') > 0 THEN substr(first_price, instr(first_price, ':') + 1)
        ELSE ''
      END AS unit_price
    FROM source_components
  ),
  normalized_components AS (
    SELECT
      *,
      CASE
        WHEN instr(price_range, '-') > 0 THEN substr(price_range, 1, instr(price_range, '-') - 1)
        ELSE ''
      END AS q_from,
      CASE
        WHEN instr(price_range, '-') > 0 THEN substr(price_range, instr(price_range, '-') + 1)
        ELSE ''
      END AS q_to
    FROM price_parts
  )
  INSERT INTO components (
    lcsc,
    category_id,
    mfr,
    package,
    joints,
    manufacturer_id,
    basic,
    preferred,
    description,
    datasheet,
    stock,
    price,
    last_update,
    extra,
    flag,
    last_on_stock
  )
  SELECT
    c.lcsc,
    cat.id,
    c.mfr,
    c.package,
    c.joints,
    m.id,
    CASE WHEN c.library_type = 'base' THEN 1 ELSE 0 END,
    COALESCE(c.preferred, 0),
    c.description,
    c.datasheet,
    c.stock,
    CASE
      WHEN trim(c.unit_price) = '' OR trim(c.q_from) = '' THEN '[]'
      ELSE json_array(json_object(
        'qFrom', CAST(c.q_from AS INTEGER),
        'qTo', CASE
          WHEN trim(c.q_to) = '' THEN NULL
          ELSE CAST(c.q_to AS INTEGER)
        END,
        'price', CAST(c.unit_price AS REAL)
      ))
    END,
    c.fetched_at,
    json_object(
      'attributes',
      json(CASE
        WHEN json_valid(c.lcsc_attributes) AND json_valid(c.attributes) THEN json_patch(c.lcsc_attributes, c.attributes)
        WHEN json_valid(c.lcsc_attributes) THEN c.lcsc_attributes
        WHEN json_valid(c.attributes) THEN c.attributes
        ELSE '{}'
      END),
      'manufacturer',
      COALESCE(NULLIF(c.lcsc_manufacturer, ''), NULLIF(c.manufacturer, ''), ''),
      'images',
      CASE
        WHEN c.lcsc_image IS NOT NULL AND c.lcsc_image != '' THEN json_array(json_object('original', 'compact/' || c.lcsc_image))
        ELSE NULL
      END,
      'url',
      CASE
        WHEN c.lcsc_url_slug IS NOT NULL AND c.lcsc_url_slug != '' THEN 'https://lcsc.com/product-detail/' || c.lcsc_url_slug || '_C' || c.lcsc || '.html'
        ELSE NULL
      END
    ),
    0,
    COALESCE(c.last_on_stock, 0)
  FROM normalized_components c
  INNER JOIN categories cat
    ON cat.category = CASE
      WHEN trim(COALESCE(c.category, '')) = '' THEN 'Uncategorized'
      ELSE c.category
    END
    AND cat.subcategory = CASE
      WHEN trim(COALESCE(c.subcategory, '')) = '' THEN 'Uncategorized'
      ELSE c.subcategory
    END
  INNER JOIN manufacturers m
    ON m.name = COALESCE(NULLIF(c.manufacturer, ''), NULLIF(c.lcsc_manufacturer, ''), '');

  CREATE INDEX components_category ON components(category_id);
  CREATE INDEX components_manufacturer ON components(manufacturer_id);

  CREATE VIEW v_components AS
    SELECT
      c.lcsc AS lcsc,
      c.category_id AS category_id,
      cat.category AS category,
      cat.subcategory AS subcategory,
      c.mfr AS mfr,
      c.package AS package,
      c.joints AS joints,
      m.name AS manufacturer,
      c.basic AS basic,
      c.preferred AS preferred,
      c.description AS description,
      c.datasheet AS datasheet,
      c.stock AS stock,
      c.last_on_stock AS last_on_stock,
      c.price AS price,
      c.extra AS extra
    FROM components c
    LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
    LEFT JOIN categories cat ON c.category_id = cat.id;
`)

const componentCount = db
  .query("SELECT COUNT(*) AS count FROM components")
  .get() as { count: number } | null

console.log(`Prepared ${componentCount?.count ?? 0} components`)

db.close()
