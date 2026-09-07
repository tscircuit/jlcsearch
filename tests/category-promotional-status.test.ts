import { Database } from "bun:sqlite"
import { afterAll, beforeAll, expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { setupDerivedTables } from "../lib/db/derivedtables/setup-derived-tables"
import { getD1Handler } from "../cf-proxy/src/d1-routes"
import { ROUTE_TO_TABLE, TABLE_RESPONSE_KEY } from "../cf-proxy/src/handlers"
import { renderD1TablePage } from "../cf-proxy/src/render"
import { createStockSyncBatchSql } from "../scripts/generate-stock-sync-sql"

const sqlite = new Database(":memory:")
const db = new Kysely<any>({
  dialect: new BunSqliteDialect({ database: sqlite }),
})
beforeAll(async () => {
  await setupDerivedTables({ db, populate: false })
  sqlite.exec(`CREATE TABLE component_catalog(lcsc INTEGER UNIQUE, stock INTEGER, is_extended_promotional INTEGER NOT NULL, package TEXT, subcategory TEXT, description TEXT, mfr TEXT, price TEXT);
    INSERT INTO component_catalog VALUES (1,300,1,'SMD','Microphones','Microphone','A','1-9:1'),(2,200,0,'SMD','Microphones','Microphone','B','1-9:2'),(3,50,1,'SMD','Other','Other','C','1-9:3');
    CREATE TABLE search_index AS SELECT lcsc,stock,is_extended_promotional FROM component_catalog;`)
  for (const table of Object.values(ROUTE_TO_TABLE)) {
    sqlite.exec(
      `INSERT INTO "${table}"(lcsc,mfr,stock) VALUES (1,'A',300),(2,'B',200),(999,'Missing catalog row',100)`,
    )
  }
})
afterAll(async () => {
  await db.destroy()
  sqlite.close()
})

test.each(Object.entries(ROUTE_TO_TABLE))(
  "%s resolves current status without changing its schema",
  async (route, table) => {
    const handler = getD1Handler(route)!
    const key = TABLE_RESPONSE_KEY[table]
    const all = await handler(db as any, {})
    expect(
      all.data[key].map((row: any) => [row.lcsc, row.is_extended_promotional]),
    ).toEqual([
      [1, true],
      [2, false],
      [999, false],
    ])
    for (const value of ["true", "1", "false", "0"]) {
      const result = await handler(db as any, {
        is_extended_promotional: value,
      })
      expect(result.data[key].map((row: any) => row.lcsc)).toEqual(
        value === "true" || value === "1" ? [1] : [2, 999],
      )
    }
    const html = renderD1TablePage(
      route,
      all.data,
      { is_extended_promotional: "1" },
      undefined,
      all.filterOptions,
    )
    expect(html).toContain('<option value="true" selected>Yes</option>')
    expect(html).toContain("Extended Promotional")
    expect(
      sqlite
        .query(
          `SELECT name FROM pragma_table_info('${table}') WHERE name='is_extended_promotional'`,
        )
        .get(),
    ).toBeNull()
  },
)

test("category membership and selected rows survive daily promotion changes", async () => {
  const handler = getD1Handler("/resistors/list")!
  sqlite.exec(
    createStockSyncBatchSql([
      { lcsc: 1, stock: 300, is_extended_promotional: 0 },
      { lcsc: 2, stock: 200, is_extended_promotional: 1 },
    ]),
  )
  expect(
    (
      await handler(db as any, { is_extended_promotional: "true" })
    ).data.resistors.map((row: any) => row.lcsc),
  ).toEqual([2])
  sqlite.exec(
    createStockSyncBatchSql([
      { lcsc: 1, stock: 300, is_extended_promotional: 1 },
      { lcsc: 2, stock: 200, is_extended_promotional: 0 },
    ]),
  )
})

test("special component aliases preserve membership while filtering status", async () => {
  sqlite.exec(`UPDATE microcontroller SET cpu_core='ARM Cortex-M4' WHERE lcsc IN (1,2);
    UPDATE microcontroller SET cpu_core='RISC-V' WHERE lcsc=999;
    INSERT INTO microcontroller(lcsc,mfr,stock,cpu_core) VALUES (3,'RV',50,'RISC-V');
    UPDATE analog_multiplexer SET num_channels=CASE lcsc WHEN 1 THEN 1 WHEN 2 THEN 2 ELSE 4 END;`)
  for (const [route, key, expected] of [
    ["/arm_processors/list", "arm_processors", 1],
    ["/risc_v_processors/list", "risc_v_processors", 3],
    ["/analog_switches/list", "switches", 1],
    ["/microphones/list", "microphones", 1],
  ] as const) {
    const handler = getD1Handler(route)!
    const result = await handler(db as any, { is_extended_promotional: "true" })
    expect(result.data[key].map((row: any) => row.lcsc)).toEqual([expected])
    expect(
      result.data[key].every(
        (row: any) => row.is_extended_promotional === true,
      ),
    ).toBe(true)
    expect(
      renderD1TablePage(
        route,
        result.data,
        { is_extended_promotional: "true" },
        undefined,
        result.filterOptions,
      ),
    ).toContain('<option value="true" selected>Yes</option>')
  }
})
