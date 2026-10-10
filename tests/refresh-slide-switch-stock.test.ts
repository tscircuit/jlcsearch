import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import {
  fetchSlideSwitchStock,
  mergeSlideSwitchStock,
} from "../scripts/refresh-slide-switch-stock"
import { createStockSyncBatchSql } from "../scripts/generate-stock-sync-sql"

const product = (lcsc = 221660, stockCount: unknown = 0) => ({
  componentCode: `C${lcsc}`,
  componentTypeEn: "Slide Switches",
  stockCount,
})
const pages = (responses: any[]) => {
  let calls = 0
  return (async (_url: any, init: any) => {
    const request = JSON.parse(init.body)
    expect(request.firstSortName).toBe("Switches")
    expect(request.secondSortName).toBe("Slide Switches")
    expect(request.currentPage).toBe(++calls)
    return Response.json({
      code: 200,
      data: { componentPageInfo: responses[calls - 1] },
    })
  }) as typeof fetch
}

test("fetches complete slide-switch pages, including an all-zero-stock category", async () => {
  expect(
    await fetchSlideSwitchStock(
      pages([
        { total: 2, list: [product()] },
        { total: 2, list: [product(2)] },
      ]),
    ),
  ).toEqual([
    { lcsc: 221660, stock: 0 },
    { lcsc: 2, stock: 0 },
  ])
})

test("rejects incomplete, duplicate, changing, wrong-category and invalid stock responses", async () => {
  for (const second of [
    { total: 2, list: [] },
    { total: 2, list: [product()] },
    { total: 3, list: [product(2)] },
    { total: 2, list: [{ ...product(2), componentTypeEn: "Resistors" }] },
    ...[null, -1, 0.5, "0"].map((stock) => ({
      total: 2,
      list: [product(2, stock)],
    })),
  ])
    await expect(
      fetchSlideSwitchStock(pages([{ total: 2, list: [product()] }, second])),
    ).rejects.toThrow()
  await expect(
    fetchSlideSwitchStock(pages([{ total: 0, list: [] }])),
  ).rejects.toThrow()
  await expect(
    fetchSlideSwitchStock(
      (async () => new Response("", { status: 503 })) as typeof fetch,
    ),
  ).rejects.toThrow("HTTP 503")
})

test("live zero overrides C221660's historical 2184 across catalog, search and switch stock", async () => {
  const prepared = new Database(":memory:")
  const remote = new Database(":memory:")
  try {
    prepared.exec(`CREATE TABLE component_stock (lcsc INTEGER PRIMARY KEY, stock INTEGER, subcategory TEXT, stock_source TEXT, record_fetched_at INTEGER);
      INSERT INTO component_stock VALUES (221660,2184,'Slide Switches','recovery_metadata',123),(2,99,'Slide Switches','upstream_snapshot',124),(3,50,'Resistors','upstream_snapshot',125);
      CREATE TABLE component_catalog (lcsc INTEGER PRIMARY KEY, stock INTEGER, subcategory TEXT);
      INSERT INTO component_catalog VALUES (221660,2184,'Slide Switches'),(2,99,'Slide Switches'),(3,50,'Resistors');
      CREATE TABLE switch (lcsc INTEGER PRIMARY KEY, stock INTEGER, in_stock INTEGER, switch_type TEXT, mfr TEXT);
      INSERT INTO switch VALUES (221660,2184,1,'Slide Switches','JS102011SAQN'),(2,99,1,'Slide Switches','Old switch'),(3,50,1,'Toggle Switches','Other switch');`)
    const rows = await fetchSlideSwitchStock(
      pages([{ total: 1, list: [product()] }]),
    )
    mergeSlideSwitchStock(prepared, rows, 1700000000)
    expect(
      prepared
        .query(
          "SELECT stock, stock_source, stock_checked_at, record_fetched_at FROM component_stock WHERE lcsc=221660",
        )
        .get(),
    ).toEqual({
      stock: 0,
      stock_source: "jlcpcb_live",
      stock_checked_at: 1700000000,
      record_fetched_at: 123,
    })
    expect(
      prepared
        .query("SELECT stock, stock_source FROM component_stock WHERE lcsc=2")
        .get(),
    ).toEqual({ stock: null, stock_source: "jlcpcb_live_missing" })
    expect(
      prepared
        .query("SELECT lcsc, stock FROM component_catalog ORDER BY lcsc")
        .all(),
    ).toEqual([
      { lcsc: 2, stock: null },
      { lcsc: 3, stock: 50 },
      { lcsc: 221660, stock: 0 },
    ])
    for (const table of ["component_catalog", "search_index", "switch"]) {
      remote.exec(
        `CREATE TABLE "${table}" (lcsc INTEGER PRIMARY KEY, stock INTEGER, in_stock INTEGER); INSERT INTO "${table}" VALUES (221660,2184,1),(2,99,1),(3,50,1);`,
      )
    }
    const batch = createStockSyncBatchSql(
      prepared
        .query<{ lcsc: number; stock: number | null }, []>(
          "SELECT lcsc, stock FROM component_stock",
        )
        .all(),
      [
        { name: "component_catalog", has_in_stock: 1 },
        { name: "search_index", has_in_stock: 1 },
        { name: "switch", has_in_stock: 1 },
      ],
    )
    remote.exec(batch)
    for (const table of ["component_catalog", "search_index", "switch"]) {
      expect(
        remote
          .query(`SELECT stock, in_stock FROM "${table}" WHERE lcsc=221660`)
          .get(),
      ).toEqual({ stock: 0, in_stock: 0 })
      expect(
        remote.query(`SELECT stock FROM "${table}" WHERE lcsc=2`).get(),
      ).toEqual({ stock: null })
    }
    expect(
      remote.query("SELECT lcsc FROM search_index WHERE stock > 0").all(),
    ).toEqual([{ lcsc: 3 }])
    mergeSlideSwitchStock(prepared, [{ lcsc: 221660, stock: 10 }], 1700000010)
    expect(
      prepared
        .query("SELECT stock, in_stock, mfr FROM switch WHERE lcsc=221660")
        .get(),
    ).toEqual({ stock: 10, in_stock: 1, mfr: "JS102011SAQN" })
  } finally {
    prepared.close()
    remote.close()
  }
})

test("invalid imports leave the prepared stock and provenance unchanged", () => {
  const db = new Database(":memory:")
  try {
    db.exec(
      "CREATE TABLE component_stock (lcsc INTEGER PRIMARY KEY, stock INTEGER); INSERT INTO component_stock VALUES (221660,2184)",
    )
    for (const rows of [
      [],
      [{ lcsc: 221660, stock: -1 }],
      [
        { lcsc: 221660, stock: 0 },
        { lcsc: 221660, stock: 10 },
      ],
    ]) {
      expect(() => mergeSlideSwitchStock(db, rows)).toThrow()
    }
    expect(db.query("SELECT stock FROM component_stock").get()).toEqual({
      stock: 2184,
    })
    expect(db.query("PRAGMA table_info(component_stock)").all()).toHaveLength(2)
  } finally {
    db.close()
  }
})
