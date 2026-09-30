import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import {
  fetchEthernetControllers,
  normalizeEthernetControllers,
  replaceEthernetControllers,
} from "../scripts/refresh-ethernet-controllers"

const product = (id: number, stock = 10) => ({
  componentTypeEn: "Ethernet Controllers",
  componentCode: `C${id}`,
  componentModelEn: "display",
  stockCount: stock,
  componentPrices: [
    { startNumber: 100, productPrice: 1 },
    { startNumber: 1, productPrice: 2 },
  ],
  attributes: [
    { attribute_name_en: "Interface", attribute_value_name: "I2C" },
    { attribute_name_en: "Size", attribute_value_name: "0.96" },
    { attribute_name_en: "Dot Pixels", attribute_value_name: "128x64" },
  ],
})
const pages = (responses: any[]) => {
  let calls = 0
  return (async (_url: any, init: any) => {
    expect(JSON.parse(init.body).currentPage).toBe(++calls)
    return Response.json({
      code: 200,
      data: { componentPageInfo: responses[calls - 1] },
    })
  }) as typeof fetch
}

test("fetches every page, including out-of-stock controllers", async () => {
  const rows = await fetchEthernetControllers(
    pages([
      { total: 3, list: [product(1), product(2)] },
      { total: 3, list: [product(3, 0)] },
    ]),
  )
  expect(rows.map((r) => r.lcsc)).toEqual([1, 2, 3])
  expect(rows[2].in_stock).toBe(0)
  expect(rows[0]).toMatchObject({
    price1: 2,
  })
})

test("rejects partial, repeated, and changing result sets", async () => {
  for (const second of [
    { total: 2, list: [] },
    { total: 2, list: [product(1)] },
    { total: 3, list: [product(2)] },
  ]) {
    await expect(
      fetchEthernetControllers(
        pages([{ total: 2, list: [product(1)] }, second]),
      ),
    ).rejects.toThrow()
  }
})

test("rejects transceivers, invalid stock, and all-out-of-stock snapshots", async () => {
  expect(() =>
    normalizeEthernetControllers({
      ...product(1),
      componentTypeEn: "Ethernet Transceivers",
    }),
  ).toThrow()
  expect(() =>
    normalizeEthernetControllers({ ...product(1), stockCount: null }),
  ).toThrow()
  await expect(
    fetchEthernetControllers(pages([{ total: 1, list: [product(1, 0)] }])),
  ).rejects.toThrow()
})

test("replaces old rows atomically and rolls back an invalid import", () => {
  const db = new Database(":memory:")
  const row = normalizeEthernetControllers(product(1))
  replaceEthernetControllers(db, [row])
  expect(() =>
    replaceEthernetControllers(db, [
      normalizeEthernetControllers(product(2)),
      normalizeEthernetControllers(product(2)),
    ]),
  ).toThrow()
  expect(db.query("SELECT lcsc FROM ethernet_controller").all()).toEqual([
    { lcsc: 1 },
  ])
  expect(() => replaceEthernetControllers(db, [])).toThrow()
  replaceEthernetControllers(db, [normalizeEthernetControllers(product(3))])
  expect(db.query("SELECT lcsc FROM ethernet_controller").all()).toEqual([
    { lcsc: 3 },
  ])
  db.close()
})

test("live refresh updates recovered catalog prices and stock snapshots", () => {
  const db = new Database(":memory:")
  db.exec(`CREATE TABLE component_catalog (lcsc INTEGER, category TEXT, subcategory TEXT, mfr TEXT, package TEXT, basic INTEGER, preferred INTEGER, description TEXT, stock INTEGER, price TEXT, extra TEXT);
    CREATE TABLE component_stock (lcsc INTEGER PRIMARY KEY, stock INTEGER);
    INSERT INTO component_catalog (lcsc,stock) VALUES (1,999),(2,888);
    INSERT INTO component_stock VALUES (1,999),(2,888);`)
  try {
    replaceEthernetControllers(db, [
      normalizeEthernetControllers(product(1, 50)),
      normalizeEthernetControllers(product(3, 0)),
    ])
    expect(
      db.query("SELECT lcsc,stock FROM component_catalog ORDER BY lcsc").all(),
    ).toEqual([
      { lcsc: 1, stock: 50 },
      { lcsc: 2, stock: 888 },
      { lcsc: 3, stock: 0 },
    ])
    expect(
      db.query("SELECT lcsc,stock FROM component_stock ORDER BY lcsc").all(),
    ).toEqual([
      { lcsc: 1, stock: 50 },
      { lcsc: 2, stock: 888 },
      { lcsc: 3, stock: 0 },
    ])
    expect(
      db.query("SELECT price FROM component_catalog WHERE lcsc=1").get(),
    ).toEqual({ price: "1-:2" })
  } finally {
    db.close()
  }
})
