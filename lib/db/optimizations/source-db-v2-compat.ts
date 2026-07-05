import { sql } from "kysely"
import type { KyselyDatabaseInstance } from "../kysely-types"
import type { DbOptimizationSpec } from "./types"

const tableExists = async (db: KyselyDatabaseInstance, tableName: string) => {
  const result = await sql<{ name: string }>`
    SELECT name
    FROM sqlite_master
    WHERE type IN ('table', 'view') AND name = ${tableName}
  `.execute(db)

  return result.rows.length > 0
}

export const sourceDbV2Compat: DbOptimizationSpec = {
  name: "materialize_source_db_v2_legacy_schema",
  description:
    "Materializes legacy jlcparts components tables from source-db-v2 jlc_components tables",

  async checkIfAdded(db: KyselyDatabaseInstance) {
    if (await tableExists(db, "components")) return true
    if (await tableExists(db, "jlc_components")) return false

    throw new Error(
      "Database does not contain legacy components or source-db-v2 jlc_components tables",
    )
  },

  async execute(db: KyselyDatabaseInstance) {
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        UNIQUE (id, category, subcategory)
      )
    `.execute(db)

    await sql`
      INSERT OR IGNORE INTO categories (id, category, subcategory)
      SELECT
        ROW_NUMBER() OVER (ORDER BY category, subcategory) AS id,
        category,
        subcategory
      FROM (
        SELECT DISTINCT category, subcategory
        FROM jlc_components
        WHERE present = 1
          AND category != ''
          AND subcategory != ''
      )
    `.execute(db)

    await sql`
      CREATE TABLE IF NOT EXISTS manufacturers (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        UNIQUE (id, name)
      )
    `.execute(db)

    await sql`
      INSERT OR IGNORE INTO manufacturers (id, name)
      SELECT
        ROW_NUMBER() OVER (ORDER BY name) AS id,
        name
      FROM (
        SELECT DISTINCT
          COALESCE(NULLIF(l.manufacturer, ''), NULLIF(j.manufacturer, ''), '') AS name
        FROM jlc_components j
        LEFT JOIN lcsc_components l ON l.lcsc = j.lcsc
        WHERE j.present = 1
          AND j.category != ''
          AND j.subcategory != ''
      )
    `.execute(db)

    await sql`
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
      )
    `.execute(db)

    await sql`
      INSERT OR IGNORE INTO components (
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
        last_on_stock,
        jlc_extra
      )
      WITH source_rows AS (
        SELECT
          j.*,
          c.id AS category_id,
          m.id AS manufacturer_id,
          COALESCE(NULLIF(l.manufacturer, ''), NULLIF(j.manufacturer, ''), '') AS manufacturer_name,
          COALESCE(NULLIF(l.attributes, ''), NULLIF(j.attributes, ''), '{}') AS extra_attributes,
          l.image AS image,
          l.url_slug AS url_slug,
          CASE
            WHEN INSTR(j.price, ',') > 0 THEN SUBSTR(j.price, 1, INSTR(j.price, ',') - 1)
            ELSE j.price
          END AS first_price
        FROM jlc_components j
        LEFT JOIN lcsc_components l ON l.lcsc = j.lcsc
        INNER JOIN categories c
          ON c.category = j.category AND c.subcategory = j.subcategory
        LEFT JOIN manufacturers m
          ON m.name = COALESCE(NULLIF(l.manufacturer, ''), NULLIF(j.manufacturer, ''), '')
        WHERE j.present = 1
      ),
      price_parts AS (
        SELECT
          *,
          SUBSTR(first_price, 1, INSTR(first_price, ':') - 1) AS range_text,
          SUBSTR(first_price, INSTR(first_price, ':') + 1) AS price_text
        FROM source_rows
      )
      SELECT
        lcsc,
        category_id,
        mfr,
        package,
        joints,
        manufacturer_id,
        CASE WHEN library_type = 'base' THEN 1 ELSE 0 END AS basic,
        preferred,
        description,
        datasheet,
        stock,
        CASE
          WHEN first_price IS NULL OR first_price = '' OR INSTR(first_price, ':') = 0 THEN '[]'
          ELSE json_array(json_object(
            'qFrom',
            CAST(SUBSTR(range_text, 1, INSTR(range_text, '-') - 1) AS INTEGER),
            'qTo',
            CASE
              WHEN SUBSTR(range_text, INSTR(range_text, '-') + 1) = '' THEN NULL
              ELSE CAST(SUBSTR(range_text, INSTR(range_text, '-') + 1) AS INTEGER)
            END,
            'price',
            CAST(price_text AS REAL)
          ))
        END AS price,
        fetched_at AS last_update,
        json_object(
          'manufacturer', json_object('name', manufacturer_name),
          'attributes', json(extra_attributes),
          'title', description,
          'mpn', mfr,
          'package', package,
          'image', image,
          'url', CASE
            WHEN url_slug IS NULL THEN NULL
            ELSE 'https://www.lcsc.com/product-detail/' || url_slug || '_C' || lcsc || '.html'
          END
        ) AS extra,
        present AS flag,
        last_on_stock,
        json_object(
          'attributes', json(attributes),
          'libraryType', library_type,
          'assembly', assembly,
          'assemblyProcess', assembly_process,
          'assemblyMode', assembly_mode,
          'websiteComponentId', website_component_id,
          'attrition', json(attrition)
        ) AS jlc_extra
      FROM price_parts
    `.execute(db)

    await sql`
      CREATE INDEX IF NOT EXISTS components_category
      ON components (category_id)
    `.execute(db)

    await sql`
      CREATE INDEX IF NOT EXISTS components_manufacturer
      ON components (manufacturer_id)
    `.execute(db)

    await sql`DROP VIEW IF EXISTS v_components`.execute(db)

    await sql`
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
      LEFT JOIN categories cat ON c.category_id = cat.id
    `.execute(db)

    await sql`DROP TABLE IF EXISTS lcsc_components`.execute(db)
    await sql`DROP TABLE IF EXISTS jlc_components`.execute(db)
  },
}
