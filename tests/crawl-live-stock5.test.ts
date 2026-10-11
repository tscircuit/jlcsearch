import { expect, test } from "bun:test"
import {
  CATEGORY_CRAWL_QUERY,
  STOCK_COVERAGE_QUERY,
  expireLiveStock,
} from "../scripts/crawl-live-stock"
import { insertPart, stockDatabase } from "./fixtures/live-stock"

test("expires observations without false zeroes and rotates failed categories behind untouched ones", async () => {
  const { db, execute, targets } = await stockDatabase()
  try {
    insertPart(db, 1)
    insertPart(db, 2)
    db.exec(`UPDATE component_catalog SET subcategory='Other Switches' WHERE lcsc=2;
      INSERT INTO _jlcsearch_stock_categories(category,subcategory,attempted_at) VALUES ('Switches','Slide Switches',unixepoch());
      INSERT INTO _jlcsearch_live_stock(lcsc,observed_stock,checked_at) VALUES (1,100,unixepoch()-73*3600),(2,10,unixepoch());`)
    expect((await execute(CATEGORY_CRAWL_QUERY))[0].subcategory).toBe(
      "Other Switches",
    )
    expect(await expireLiveStock(execute, targets)).toBe(1)
    expect(await expireLiveStock(execute, targets)).toBe(0)
    for (const target of targets)
      expect(
        db
          .query(`SELECT stock,in_stock FROM "${target.name}" WHERE lcsc=1`)
          .get(),
      ).toEqual({ stock: null, in_stock: 0 })
    expect(
      db
        .query(
          "SELECT observed_stock, expired FROM _jlcsearch_live_stock WHERE lcsc=1",
        )
        .get(),
    ).toEqual({ observed_stock: 100, expired: 1 })
    expect((await execute(STOCK_COVERAGE_QUERY))[0]).toMatchObject({
      catalog_parts: 2,
      ever_checked: 2,
      checked_within_24h: 1,
      within_freshness_limit: 1,
    })
  } finally {
    db.close()
  }
})
