import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { correctSourceMetadata } from "../scripts/correct-source-metadata"

test("metadata repair preserves removal, recovery provenance, and nonmatching identities", () => {
  const db = new Database(":memory:")
  try {
    db.exec(`CREATE TABLE input_jlc_components(lcsc INTEGER,mfr TEXT,manufacturer TEXT,category TEXT,subcategory TEXT,present INTEGER,stock INTEGER,stock_source TEXT);
      INSERT INTO input_jlc_components VALUES
        (42388007,'RK3576','','Others','Others',0,0,'recovery_metadata'),
        (1,'RK3576','','Others','Others',1,20,'upstream_snapshot'),
        (42388007,'different','','Others','Others',1,30,'upstream_snapshot');`)
    correctSourceMetadata(db)
    expect(
      db
        .query(
          "SELECT manufacturer,present,stock,stock_source FROM corrected_jlc_components WHERE lcsc=42388007 AND mfr='RK3576'",
        )
        .get(),
    ).toEqual({
      manufacturer: "Rockchip",
      present: 0,
      stock: 0,
      stock_source: "recovery_metadata",
    })
    expect(
      db
        .query(
          "SELECT COUNT(*) AS n FROM corrected_jlc_components WHERE manufacturer=''",
        )
        .get(),
    ).toEqual({ n: 2 })
  } finally {
    db.close()
  }
})

test("production migration corrects metadata, invalidates legacy FTS and queues live stock without changing inventory", async () => {
  const db = new Database(":memory:")
  try {
    db.exec(`CREATE TABLE component_catalog(lcsc INTEGER,mfr TEXT,category TEXT,subcategory TEXT,extra TEXT,stock INTEGER);
      INSERT INTO component_catalog VALUES (42388007,'RK3576','Others','Others','{}',487);
      CREATE TABLE search_index(lcsc INTEGER,mfr TEXT,category TEXT,subcategory TEXT,manufacturer_name TEXT,title TEXT,search_text TEXT,package TEXT,description TEXT,attributes TEXT,stock INTEGER);
      INSERT INTO search_index(lcsc,mfr,stock) VALUES (42388007,'RK3576',487);
      CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY,value TEXT);
      INSERT INTO search_index_fts_meta VALUES ('ready','1'),('ready_lcsc','1');`)
    db.exec(
      await Bun.file(
        new URL(
          "../cf-proxy/migrations/0019_requested_stock.sql",
          import.meta.url,
        ),
      ).text(),
    )
    db.exec(
      await Bun.file(
        new URL(
          "../cf-proxy/migrations/0020_rk3576_metadata.sql",
          import.meta.url,
        ),
      ).text(),
    )
    expect(
      db
        .query(
          "SELECT json_extract(extra,'$.manufacturer.name') AS manufacturer,stock FROM component_catalog",
        )
        .get(),
    ).toEqual({ manufacturer: "Rockchip", stock: 487 })
    expect(
      db
        .query("SELECT manufacturer_name,subcategory,stock FROM search_index")
        .get(),
    ).toEqual({
      manufacturer_name: "Rockchip",
      subcategory: "Microcontrollers (MCU/MPU/SOC)",
      stock: 487,
    })
    expect(
      db
        .query(
          "SELECT COUNT(*) AS n FROM search_index_fts_meta WHERE value='1'",
        )
        .get(),
    ).toEqual({ n: 0 })
    expect(
      db
        .query(
          "SELECT lcsc,attempted_at,verified_at FROM _jlcsearch_requested_parts",
        )
        .get(),
    ).toEqual({ lcsc: 42388007, attempted_at: 0, verified_at: null })
  } finally {
    db.close()
  }
})
