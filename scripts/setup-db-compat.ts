import { getBunDatabaseClient } from "lib/db/get-db-client"

const tableExists = (
  db: ReturnType<typeof getBunDatabaseClient>,
  name: string,
) =>
  db
    .query<{ name: string }, [string]>(
      "SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ? LIMIT 1",
    )
    .get(name) !== null

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
  db.exec(`
    INSERT INTO components (
      lcsc, category_id, mfr, package, joints, manufacturer_id, basic,
      preferred, description, datasheet, stock, price, last_update, extra,
      flag, last_on_stock, jlc_extra
    )
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
      json_object('attributes', json(COALESCE(NULLIF(l.attributes, ''), '{}'))) AS extra,
      j.sync_seen AS flag,
      j.last_on_stock,
      json_object(
        'rohs', CASE
          WHEN j.rohs IS NULL THEN NULL
          WHEN j.rohs = 0 THEN json('false')
          ELSE json('true')
        END,
        'eccn', j.eccn,
        'assembly', CASE
          WHEN j.assembly IS NULL THEN NULL
          WHEN j.assembly = 0 THEN json('false')
          ELSE json('true')
        END,
        'assemblyProcess', j.assembly_process,
        'assemblyMode', j.assembly_mode,
        'websiteComponentId', j.website_component_id,
        'attrition', json(COALESCE(NULLIF(j.attrition, ''), '{}')),
        'attributes', json(COALESCE(NULLIF(j.attributes, ''), '{}'))
      ) AS jlc_extra
    FROM jlc_components j
    LEFT JOIN lcsc_components l ON l.lcsc = j.lcsc
    JOIN categories cat
      ON cat.category = j.category AND cat.subcategory = j.subcategory
    JOIN manufacturers m
      ON m.name = COALESCE(NULLIF(j.manufacturer, ''), NULLIF(l.manufacturer, ''), '')
    WHERE j.present = 1;
  `)
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
