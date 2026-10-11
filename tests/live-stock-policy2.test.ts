import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { overlayImportStock } from "../scripts/overlay-import-stock"
import { insertPart, stockDatabase } from "./fixtures/live-stock"

test("derived and full imports apply live precedence within each metadata batch", async () => {
  const { db } = await stockDatabase()
  const source = new Database(":memory:")
  try {
    insertPart(db, 1)
    insertPart(db, 2)
    insertPart(db, 3)
    db.exec(
      "INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at) VALUES (1,0,unixepoch()),(2,20,unixepoch())",
    )
    source.exec(`CREATE TABLE component_catalog (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      INSERT INTO component_catalog VALUES (1,2184),(2,100),(3,100);
      CREATE TABLE component_stock (lcsc INTEGER PRIMARY KEY, stock INTEGER, stock_checked_at INTEGER);
      INSERT INTO component_stock VALUES (2,30,unixepoch()+1);`)
    db.exec(overlayImportStock(source, "component_catalog", 0, 2))
    expect(
      db.query("SELECT lcsc,stock FROM component_catalog ORDER BY lcsc").all(),
    ).toEqual([
      { lcsc: 1, stock: 0 },
      { lcsc: 2, stock: 30 },
      { lcsc: 3, stock: 2184 },
    ])
    expect(
      db
        .query("SELECT observed_stock FROM _jlcsearch_live_stock WHERE lcsc=2")
        .get(),
    ).toEqual({ observed_stock: 30 })
    // A source without an observation table is still protected by remote checks.
    source.exec("DROP TABLE component_stock")
    db.exec(overlayImportStock(source, "component_catalog", 0, 3))
    expect(
      db.query("SELECT stock FROM component_catalog WHERE lcsc=1").get(),
    ).toEqual({ stock: 0 })
  } finally {
    db.close()
    source.close()
  }
})
