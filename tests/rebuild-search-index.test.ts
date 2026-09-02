import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

test("search index preserves JLCPCB component product type", () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE component_catalog (
      lcsc INTEGER,
      mfr TEXT,
      package TEXT,
      description TEXT,
      stock INTEGER,
      price TEXT,
      basic INTEGER,
      preferred INTEGER,
      component_product_type INTEGER,
      category TEXT,
      subcategory TEXT,
      extra TEXT
    );

    INSERT INTO component_catalog VALUES (
      12345,
      'HDMI-19P',
      'SMD',
      'HDMI connector',
      250,
      '1-9:1.25,10-:0.75',
      1,
      1,
      0,
      'Connectors',
      'HDMI Connectors',
      '{}'
    );
  `)

  const rebuildSql = readFileSync(
    path.resolve(
      "cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
    ),
    "utf8",
  )
  database.exec(rebuildSql)

  expect(
    database
      .query(
        `SELECT lcsc, component_product_type
         FROM search_index`,
      )
      .get(),
  ).toEqual({
    lcsc: 12345,
    component_product_type: 0,
  })

  database.close()
})
