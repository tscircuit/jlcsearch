import { getBunDatabaseClient } from "lib/db/get-db-client"

const BATCH_SIZE = 5000

type SourceComponentRow = {
  lcsc: number
  category_id: number
  mfr: string
  package: string
  joints: number
  manufacturer_id: number
  basic: number
  preferred: number
  description: string
  datasheet: string
  stock: number
  price: string
  last_update: number
  last_on_stock: number
  flag: number
  jlc_attributes: string
  rohs: number | null
  eccn: string
  assembly: number | null
  assembly_process: string | null
  assembly_mode: string | null
  website_component_id: string | null
  attrition: string
  lcsc_attributes: string | null
  lcsc_image: string | null
  lcsc_url_slug: string | null
  lcsc_manufacturer: string | null
}

const tableExists = (
  db: ReturnType<typeof getBunDatabaseClient>,
  name: string,
) =>
  db
    .query<{ name: string }, [string]>(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1",
    )
    .get(name) !== null

const parseJsonObject = (value: string | null): Record<string, unknown> => {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

const parsePrice = (priceString: string | null) => {
  if (!priceString?.trim()) return []

  return priceString
    .split(",")
    .filter(Boolean)
    .map((price) => {
      const [rangeText, priceText] = price.split(":")
      const [qFrom, qTo] = rangeText.split("-")
      return {
        qFrom: Number.parseInt(qFrom, 10),
        qTo: qTo ? Number.parseInt(qTo, 10) : null,
        price: Number.parseFloat(priceText),
      }
    })
    .filter(
      (price) => Number.isFinite(price.qFrom) && Number.isFinite(price.price),
    )
    .sort((a, b) => a.qFrom - b.qFrom)
}

const buildExtra = (row: SourceComponentRow) => {
  const attributes = parseJsonObject(row.lcsc_attributes)
  const extra: Record<string, unknown> = { attributes }

  if (row.lcsc_image) {
    extra.images = [{ original: `compact/${row.lcsc_image}` }]
  }

  if (row.lcsc_url_slug) {
    extra.url = `https://lcsc.com/product-detail/${row.lcsc_url_slug}_C${row.lcsc}.html`
  }

  if (row.lcsc_manufacturer) {
    extra.manufacturer = row.lcsc_manufacturer
  }

  return Object.keys(attributes).length === 0 && Object.keys(extra).length === 1
    ? "{}"
    : JSON.stringify(extra)
}

const buildJlcExtra = (row: SourceComponentRow) =>
  JSON.stringify({
    rohs: row.rohs === null ? null : Boolean(row.rohs),
    eccn: row.eccn,
    assembly: row.assembly === null ? null : Boolean(row.assembly),
    assemblyProcess: row.assembly_process,
    assemblyMode: row.assembly_mode,
    websiteComponentId: row.website_component_id,
    attrition: parseJsonObject(row.attrition),
    attributes: parseJsonObject(row.jlc_attributes),
  })

const createLegacySchema = (db: ReturnType<typeof getBunDatabaseClient>) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS components (
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
      last_on_stock INTEGER NOT NULL DEFAULT 0,
      jlc_extra TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS manufacturers (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      UNIQUE (id, name)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      UNIQUE (id, category, subcategory)
    );

    CREATE TABLE IF NOT EXISTS jlcpcb_component_details (
      lcsc INTEGER PRIMARY KEY NOT NULL,
      fetched_at INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
  `)
}

const populateLegacyLookupTables = (
  db: ReturnType<typeof getBunDatabaseClient>,
) => {
  db.exec(`
    INSERT INTO categories (category, subcategory)
    SELECT category, subcategory
    FROM jlc_components
    WHERE present = 1
    GROUP BY category, subcategory
    ORDER BY category, subcategory;

    INSERT INTO manufacturers (name)
    SELECT COALESCE(NULLIF(j.manufacturer, ''), NULLIF(l.manufacturer, ''), '')
    FROM jlc_components j
    LEFT JOIN lcsc_components l ON l.lcsc = j.lcsc
    WHERE j.present = 1
    GROUP BY COALESCE(NULLIF(j.manufacturer, ''), NULLIF(l.manufacturer, ''), '')
    ORDER BY COALESCE(NULLIF(j.manufacturer, ''), NULLIF(l.manufacturer, ''), '');
  `)
}

const populateLegacyComponents = (
  db: ReturnType<typeof getBunDatabaseClient>,
) => {
  const selectRows = db.query<SourceComponentRow, [number, number]>(`
    SELECT
      j.lcsc,
      cat.id AS category_id,
      j.mfr,
      j.package,
      j.joints,
      m.id AS manufacturer_id,
      CASE WHEN j.library_type = 'base' THEN 1 ELSE 0 END AS basic,
      j.preferred,
      j.description,
      j.datasheet,
      j.stock,
      j.price,
      COALESCE(l.fetched_at, j.fetched_at) AS last_update,
      j.last_on_stock,
      j.sync_seen AS flag,
      j.attributes AS jlc_attributes,
      j.rohs,
      j.eccn,
      j.assembly,
      j.assembly_process,
      j.assembly_mode,
      j.website_component_id,
      j.attrition,
      l.attributes AS lcsc_attributes,
      l.image AS lcsc_image,
      l.url_slug AS lcsc_url_slug,
      l.manufacturer AS lcsc_manufacturer
    FROM jlc_components j
    LEFT JOIN lcsc_components l ON l.lcsc = j.lcsc
    JOIN categories cat
      ON cat.category = j.category AND cat.subcategory = j.subcategory
    JOIN manufacturers m
      ON m.name = COALESCE(NULLIF(j.manufacturer, ''), NULLIF(l.manufacturer, ''), '')
    WHERE j.present = 1 AND j.lcsc > ?
    ORDER BY j.lcsc
    LIMIT ?
  `)

  const insertRow = db.prepare(`
    INSERT INTO components (
      lcsc, category_id, mfr, package, joints, manufacturer_id, basic,
      preferred, description, datasheet, stock, price, last_update, extra,
      flag, last_on_stock, jlc_extra
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let totalRows = 0
  let lastLcsc = 0

  while (true) {
    const rows = selectRows.all(lastLcsc, BATCH_SIZE)
    if (rows.length === 0) break

    db.exec("BEGIN")
    try {
      for (const row of rows) {
        insertRow.run(
          row.lcsc,
          row.category_id,
          row.mfr,
          row.package,
          row.joints,
          row.manufacturer_id,
          row.basic,
          row.preferred,
          row.description,
          row.datasheet,
          row.stock,
          JSON.stringify(parsePrice(row.price)),
          row.last_update,
          buildExtra(row),
          row.flag,
          row.last_on_stock,
          buildJlcExtra(row),
        )
      }
      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }

    totalRows += rows.length
    lastLcsc = rows[rows.length - 1].lcsc
    console.log(`Migrated ${totalRows} components into legacy schema`)
  }
}

const createLegacyIndexesAndView = (
  db: ReturnType<typeof getBunDatabaseClient>,
) => {
  db.exec(`
    CREATE INDEX IF NOT EXISTS components_category
    ON components (category_id);

    CREATE INDEX IF NOT EXISTS components_manufacturer
    ON components (manufacturer_id);

    DROP VIEW IF EXISTS v_components;

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
        c.extra AS extra,
        c.jlc_extra AS jlc_extra
      FROM components c
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN categories cat ON c.category_id = cat.id;
  `)
}

const main = () => {
  const db = getBunDatabaseClient()

  try {
    if (tableExists(db, "components")) {
      console.log("Legacy components table already exists")
      return
    }

    if (!tableExists(db, "jlc_components")) {
      throw new Error(
        "db.sqlite3 contains neither legacy components nor source jlc_components tables",
      )
    }

    console.log("Creating legacy jlcsearch tables from source-db-v2 cache")
    createLegacySchema(db)
    populateLegacyLookupTables(db)
    populateLegacyComponents(db)
    createLegacyIndexesAndView(db)
    console.log("Legacy jlcsearch compatibility schema created")
  } finally {
    db.close()
  }
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
