import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import {
  fetchOledDisplays,
  normalizeOled,
  replaceOledDisplays,
} from "../scripts/refresh-oled-displays"

const product = (id: number, stock = 10) => ({
  componentTypeEn: "OLED Display",
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

test("fetches every page, including out-of-stock displays", async () => {
  const rows = await fetchOledDisplays(
    pages([
      { total: 3, list: [product(1), product(2)] },
      { total: 3, list: [product(3, 0)] },
    ]),
  )
  expect(rows.map((r) => r.lcsc)).toEqual([1, 2, 3])
  expect(rows[2].in_stock).toBe(0)
  expect(rows[0]).toMatchObject({
    price1: 2,
    protocol: "I2C",
    display_width: "0.96",
    pixel_resolution: "128x64",
  })
})

test("rejects partial, repeated, and changing result sets", async () => {
  for (const second of [
    { total: 2, list: [] },
    { total: 2, list: [product(1)] },
    { total: 3, list: [product(2)] },
  ]) {
    await expect(
      fetchOledDisplays(pages([{ total: 2, list: [product(1)] }, second])),
    ).rejects.toThrow()
  }
})

test("rejects drivers, invalid stock, and all-out-of-stock snapshots", async () => {
  expect(() =>
    normalizeOled({ ...product(1), componentTypeEn: "OLED Drivers" }),
  ).toThrow()
  expect(() => normalizeOled({ ...product(1), stockCount: null })).toThrow()
  await expect(
    fetchOledDisplays(pages([{ total: 1, list: [product(1, 0)] }])),
  ).rejects.toThrow()
})

test("replaces old rows atomically and rolls back an invalid import", () => {
  const db = new Database(":memory:")
  const row = normalizeOled(product(1))
  replaceOledDisplays(db, [row])
  expect(() =>
    replaceOledDisplays(db, [
      normalizeOled(product(2)),
      normalizeOled(product(2)),
    ]),
  ).toThrow()
  expect(db.query("SELECT lcsc FROM oled_display").all()).toEqual([{ lcsc: 1 }])
  expect(() => replaceOledDisplays(db, [])).toThrow()
  replaceOledDisplays(db, [normalizeOled(product(3))])
  expect(db.query("SELECT lcsc FROM oled_display").all()).toEqual([{ lcsc: 3 }])
  db.close()
})
