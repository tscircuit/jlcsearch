import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { getD1Handler } from "../../cf-proxy/src/d1-routes"
import { CATEGORY_CRAWL_QUERY } from "../../scripts/crawl-live-stock"
import {
  CATEGORY_INDEX,
  catalogSchemaFromSyncScript,
  explain,
} from "../fixtures/catalog-category-index"

test("category listings read the category index, not every catalog row", async () => {
  const sqlite = new Database(":memory:")
  const queries: Array<{ sql: string; parameters: readonly unknown[] }> = []
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database: sqlite }),
    log: (event) => {
      if (event.level === "query") {
        queries.push({
          sql: event.query.sql,
          parameters: event.query.parameters,
        })
      }
    },
  })
  try {
    sqlite.exec(await catalogSchemaFromSyncScript())
    sqlite.exec(`
      INSERT INTO component_catalog (lcsc, category, subcategory, package, stock)
      VALUES (1, 'Resistors', 'Chip Resistor', '0402', 10),
        (2, 'Resistors', 'Chip Resistor', '0402', 5),
        (3, 'Resistors', 'Resistor Networks', '0603', 0),
        (4, 'Capacitors', 'MLCC', '0402', 7),
        (5, NULL, NULL, NULL, 1);
      CREATE TABLE _jlcsearch_stock_categories (category TEXT, subcategory TEXT,
        next_page INTEGER, cycle TEXT, expected_total INTEGER, consistent INTEGER,
        web_category TEXT, web_subcategory TEXT, attempted_at INTEGER,
        completed_at INTEGER, PRIMARY KEY (category, subcategory));`)
    const run = async (params: Record<string, string>) => {
      queries.length = 0
      const result = await getD1Handler("/categories/list")!(
        db as never,
        params,
      )
      expect(queries).toHaveLength(1)
      return {
        data: result.data,
        plan: explain(sqlite, queries[0].sql, [...queries[0].parameters]),
      }
    }

    const categories = await run({})
    expect(categories.data).toEqual({
      categories: [
        { category: "Capacitors", subcategory: "MLCC" },
        { category: "Resistors", subcategory: "Chip Resistor" },
      ],
    })
    expect(categories.plan).toContain(`USING COVERING INDEX ${CATEGORY_INDEX}`)
    expect(categories.plan).not.toContain("TEMP B-TREE")

    const subcategories = await run({ category_name: "Resistors" })
    expect(subcategories.data).toEqual({
      categories: [
        { category: "Resistors", subcategory: "Chip Resistor" },
        { category: "Resistors", subcategory: "Resistor Networks" },
      ],
    })
    expect(subcategories.plan).toContain(
      `USING COVERING INDEX ${CATEGORY_INDEX} (category=?)`,
    )

    // The hourly stock crawl starts with the same distinct category pairs.
    expect(
      explain(sqlite, CATEGORY_CRAWL_QUERY.replace(/;\s*$/, "")),
    ).toContain(`component_catalog USING COVERING INDEX ${CATEGORY_INDEX}`)
  } finally {
    await db.destroy()
  }
})
