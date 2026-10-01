import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import {
  fetchOpticalSensors,
  normalizeOpticalSensor,
  mergeOpticalSensors,
} from "../scripts/refresh-optical-sensors"

const source = [{ category: "Sensors", subcategory: "Specialized Sensors" }]
const product = (lcsc = 20612443, overrides: Record<string, unknown> = {}) => ({
  componentTypeEn: "Specialized Sensors",
  componentCode: `C${lcsc}`,
  componentModelEn: "PMW3360DM-T2QU",
  componentSpecificationEn: "DIP-16",
  describe: "Low-power mode DIP-16 Specialized Sensors ROHS",
  stockCount: 0,
  componentLibraryType: "expand",
  preferredComponentFlag: false,
  attributes: [{ attribute_name_en: "Interface", attribute_value_name: "SPI" }],
  componentPrices: [
    { startNumber: 1000, productPrice: 1 },
    { startNumber: 1, productPrice: 2.4873 },
  ],
  ...overrides,
})
const pages = (responses: any[]) => {
  let calls = 0
  return (async (_url: any, init: any) => {
    const query = JSON.parse(init.body)
    expect(query.currentPage).toBe(++calls)
    expect(query.firstSortName).toBe("Sensors")
    expect(query.secondSortName).toBe("Specialized Sensors")
    return Response.json({
      code: 200,
      data: { componentPageInfo: responses[calls - 1] },
    })
  }) as typeof fetch
}

test("imports Mustafa's PMW3360 despite zero stock and a non-optical catalog label", async () => {
  const rows = await fetchOpticalSensors(
    pages([
      {
        total: 3,
        list: [
          product(),
          product(2, {
            componentModelEn: "LDC1612",
            describe: "Inductance-to-Digital Converter",
            stockCount: 10,
          }),
        ],
      },
      { total: 3, list: [product(3, { componentModelEn: "PAW3395DM-T6QU" })] },
    ]),
    source,
  )
  expect(rows.map((row) => row.lcsc)).toEqual([20612443, 3])
  expect(rows[0]).toMatchObject({
    mfr: "PMW3360DM-T2QU",
    stock: 0,
    in_stock: 0,
    price1: 2.4873,
    sensor_type: "Optical Motion",
    package: "DIP-16",
    attributes: '{"Interface":"SPI"}',
  })
})

test("refuses incomplete, duplicate, wrong-category, invalid-stock or empty snapshots", async () => {
  for (const second of [
    { total: 2, list: [] },
    { total: 2, list: [product()] },
    { total: 3, list: [product(2)] },
    { total: 2, list: [product(2, { componentTypeEn: "Resistors" })] },
    { total: 2, list: [product(2, { stockCount: null })] },
  ]) {
    await expect(
      fetchOpticalSensors(
        pages([{ total: 2, list: [product()] }, second]),
        source,
      ),
    ).rejects.toThrow()
  }
  await expect(
    fetchOpticalSensors(pages([{ total: 0, list: [] }]), source),
  ).rejects.toThrow()
  expect(() => normalizeOpticalSensor(product(1, { stockCount: -1 }))).toThrow()
})

test("refreshes stale stock while retaining other upstream types and rolls back invalid merges", () => {
  const db = new Database(":memory:")
  try {
    db.exec(
      "CREATE TABLE component_stock (lcsc INTEGER PRIMARY KEY, stock INTEGER); INSERT INTO component_stock VALUES (20612443, 100)",
    )
    mergeOpticalSensors(db, [
      normalizeOpticalSensor(product())!,
      normalizeOpticalSensor(
        product(2, {
          componentModelEn: "OTHER",
          componentTypeEn: "UV Sensors",
          stockCount: 10,
        }),
      )!,
    ])
    mergeOpticalSensors(db, [
      normalizeOpticalSensor(
        product(3, { componentModelEn: "PAW3395DM-T6QU" }),
      )!,
    ])
    expect(
      db.query("SELECT lcsc, stock FROM optical_sensor ORDER BY lcsc").all(),
    ).toEqual([
      { lcsc: 2, stock: 10 },
      { lcsc: 3, stock: 0 },
      { lcsc: 20612443, stock: 0 },
    ])
    expect(
      db.query("SELECT stock FROM component_stock WHERE lcsc=20612443").get(),
    ).toEqual({ stock: 0 })
    expect(() =>
      mergeOpticalSensors(db, [
        normalizeOpticalSensor(product(4))!,
        normalizeOpticalSensor(product(4))!,
      ]),
    ).toThrow()
    expect(
      db.query("SELECT lcsc FROM optical_sensor WHERE lcsc=4").get(),
    ).toBeNull()
    expect(
      db.query("SELECT lcsc FROM component_stock WHERE lcsc=4").get(),
    ).toBeNull()
    expect(
      db
        .query(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='optical_sensor'",
        )
        .all(),
    ).toHaveLength(5)
    expect(() => mergeOpticalSensors(db, [])).toThrow()
  } finally {
    db.close()
  }
})

test("accepts optical categories with no live products when other categories are complete", async () => {
  let calls = 0
  const fetcher = (async (_url: any, init: any) => {
    const query = JSON.parse(init.body)
    expect(query.currentPage).toBe(1)
    calls++
    return Response.json({
      code: 200,
      data: {
        componentPageInfo:
          calls === 1
            ? { total: 0, list: null }
            : { total: 1, list: [product()] },
      },
    })
  }) as typeof fetch
  expect(
    await fetchOpticalSensors(fetcher, [
      { category: "Sensors", subcategory: "Color Sensors" },
      ...source,
    ]),
  ).toHaveLength(1)
})
