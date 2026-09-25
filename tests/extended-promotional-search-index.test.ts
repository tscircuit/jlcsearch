import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { queryComponentCatalog } from "../cf-proxy/src/components"
import { searchIndex } from "../cf-proxy/src/search"

test("search index materializes and filters extended promotional parts", async () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE component_catalog (
      lcsc INTEGER NOT NULL UNIQUE,
      category TEXT,
      subcategory TEXT,
      mfr TEXT,
      package TEXT,
      basic INTEGER,
      preferred INTEGER,
      is_extended_promotional INTEGER,
      description TEXT,
      stock INTEGER,
      price TEXT,
      extra TEXT
    );

    INSERT INTO component_catalog (
      lcsc, category, subcategory, mfr, package, basic, preferred,
      is_extended_promotional, description, stock, price, extra
    ) VALUES
      (1001, 'Connectors', 'HDMI', 'HDMI-BASE', 'SMD', 1, 1, 0,
       'Base HDMI part', 100, '1-:1.25', '{}'),
      (1002, 'Connectors', 'HDMI', 'HDMI-EXT', 'SMD', 0, 1, 1,
       'Extended promotional HDMI part', 200, '1-:1.50', '{}'),
      (1003, 'Connectors', 'HDMI', 'HDMI-REGULAR-EXT', 'SMD', 0, 0, 0,
       'Regular extended HDMI part', 150, '1-:1.75', '{}');
  `)

  const rebuildScript = await Bun.file(
    new URL(
      "../cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
      import.meta.url,
    ),
  ).text()
  database.exec(rebuildScript)

  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })
  const searchDb = db as unknown as Parameters<typeof searchIndex>[0]

  try {
    const rows = await searchIndex(searchDb, {
      is_extended_promotional: "true",
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      lcsc: 1002,
      is_extended_promotional: 1,
    })

    const numericRows = await searchIndex(searchDb, {
      is_extended_promotional: "1",
    })
    expect(numericRows.map((row) => row.lcsc)).toEqual([1002])

    const catalogRows = await queryComponentCatalog(searchDb, {
      is_extended_promotional: "true",
    })
    expect(catalogRows.map((row) => row.lcsc)).toEqual([1002])

    expect(
      database
        .query(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'index'
             AND name = 'idx_search_index_extended_promotional_stock'`,
        )
        .get(),
    ).toEqual({ name: "idx_search_index_extended_promotional_stock" })
  } finally {
    await db.destroy()
  }
})
