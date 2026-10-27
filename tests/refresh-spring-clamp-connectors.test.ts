import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import {
  fetchSpringClampConnectors,
  normalizeSpringClamp,
  replaceSpringClampConnectors,
} from "../scripts/refresh-spring-clamp-connectors"

const product = (id: number, stock = 10) => ({
  componentTypeEn: "Spring Clamp System Terminal Block",
  componentCode: `C${id}`,
  componentModelEn: "221-415",
  componentBrandEn: "WAGO",
  stockCount: stock,
  componentPrices: [
    { startNumber: 100, productPrice: 1 },
    { startNumber: 1, productPrice: 2 },
  ],
  attributes: [
    { attribute_name_en: "Number of Pins", attribute_value_name: "5P" },
    { attribute_name_en: "Current Rating", attribute_value_name: "32A" },
    {
      attribute_name_en: "Mounting Type",
      attribute_value_name: "Free Hanging",
    },
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

test("fetches every page, including out-of-stock connectors", async () => {
  const rows = await fetchSpringClampConnectors(
    pages([
      { total: 3, list: [product(1), product(2)] },
      { total: 3, list: [product(3, 0)] },
    ]),
  )
  expect(rows.map((r) => r.lcsc)).toEqual([1, 2, 3])
  expect(rows[2].in_stock).toBe(0)
  expect(rows[0]).toMatchObject({
    price1: 2,
    description: "WAGO",
    num_pins: 5,
    current_rating: 32,
    mounting_style: "Free Hanging",
  })
})

test("rejects partial, repeated, and changing result sets", async () => {
  for (const second of [
    { total: 2, list: [] },
    { total: 2, list: [product(1)] },
    { total: 3, list: [product(2)] },
  ]) {
    await expect(
      fetchSpringClampConnectors(
        pages([{ total: 2, list: [product(1)] }, second]),
      ),
    ).rejects.toThrow()
  }
})

test("rejects drivers, invalid stock, and all-out-of-stock snapshots", async () => {
  expect(() =>
    normalizeSpringClamp({ ...product(1), componentTypeEn: "OLED Drivers" }),
  ).toThrow()
  expect(() =>
    normalizeSpringClamp({ ...product(1), stockCount: null }),
  ).toThrow()
  await expect(
    fetchSpringClampConnectors(pages([{ total: 1, list: [product(1, 0)] }])),
  ).rejects.toThrow()
})

test("replaces old rows atomically and rolls back an invalid import", () => {
  const db = new Database(":memory:")
  const row = normalizeSpringClamp(product(1))
  replaceSpringClampConnectors(db, [row])
  expect(() =>
    replaceSpringClampConnectors(db, [
      normalizeSpringClamp(product(2)),
      normalizeSpringClamp(product(2)),
    ]),
  ).toThrow()
  expect(
    db.query("SELECT lcsc FROM spring_clamp_terminal_block").all(),
  ).toEqual([{ lcsc: 1 }])
  expect(() => replaceSpringClampConnectors(db, [])).toThrow()
  replaceSpringClampConnectors(db, [normalizeSpringClamp(product(3))])
  expect(
    db.query("SELECT lcsc FROM spring_clamp_terminal_block").all(),
  ).toEqual([{ lcsc: 3 }])
  db.close()
})

test("maps real stocked WAGO catalog records", () => {
  for (const product of wagoFixtures) {
    const row = normalizeSpringClamp(product)
    expect(row.mfr).toBe(product.componentModelEn)
    expect(row.stock).toBe(product.stockCount)
    expect(row.description).toContain("WAGO")
    expect(row.current_rating).toBe(32)
    expect(row.num_pins).toBeGreaterThan(0)
  }
})

const wagoFixtures = [
  {
    componentTypeEn: "Spring Clamp System Terminal Block",
    componentCode: "C2765050",
    componentModelEn: "221-415",
    componentBrandEn: "WAGO",
    stockCount: 12,
    componentPrices: [
      {
        startNumber: 1,
        endNumber: 9,
        productPrice: 1.411,
      },
      {
        startNumber: 10,
        endNumber: 29,
        productPrice: 1.1786,
      },
      {
        startNumber: 30,
        endNumber: 99,
        productPrice: 1.0149,
      },
      {
        startNumber: 100,
        endNumber: 499,
        productPrice: 0.8708,
      },
      {
        startNumber: 500,
        endNumber: 999,
        productPrice: 0.807,
      },
      {
        startNumber: 1000,
        endNumber: -1,
        productPrice: 0.7775,
      },
    ],
    attributes: [
      {
        attribute_name_en: "Operating Temperature",
        attribute_value_name: "-",
      },
      {
        attribute_name_en: "Number of Positions or Pins",
        attribute_value_name: "1x5P",
      },
      {
        attribute_name_en: "Number of Rows",
        attribute_value_name: "1",
      },
      {
        attribute_name_en: "Voltage Rating (Max)",
        attribute_value_name: "450V",
      },
      {
        attribute_name_en: "Color",
        attribute_value_name: "-",
      },
      {
        attribute_name_en: "Number of Pins",
        attribute_value_name: "5P",
      },
      {
        attribute_name_en: "Current Rating",
        attribute_value_name: "32A",
      },
      {
        attribute_name_en: "Pitch",
        attribute_value_name: "-",
      },
      {
        attribute_name_en: "Wire Gauge - mm2",
        attribute_value_name: "0.2~4",
      },
      {
        attribute_name_en: "Wire Gauge - AWG",
        attribute_value_name: "12~24",
      },
      {
        attribute_name_en: "Height Above Board",
        attribute_value_name: "8.6mm",
      },
      {
        attribute_name_en: "Mounting Type",
        attribute_value_name: "Free Hanging",
      },
      {
        attribute_name_en: "Number of PINs Per Row",
        attribute_value_name: "5",
      },
    ],
    describe:
      "1 12~24 1x5P 32A 450V 5 5P Free Hanging - Spring Clamp System Terminal Block ROHS",
    componentSpecificationEn: "-",
    componentLibraryType: "expand",
    preferredComponentFlag: false,
  },
  {
    componentTypeEn: "Spring Clamp System Terminal Block",
    componentCode: "C2765051",
    componentModelEn: "222-412",
    componentBrandEn: "WAGO",
    stockCount: 10,
    componentPrices: [
      {
        startNumber: 1,
        endNumber: 9,
        productPrice: 0.4485,
      },
      {
        startNumber: 10,
        endNumber: 29,
        productPrice: 0.3569,
      },
      {
        startNumber: 30,
        endNumber: 99,
        productPrice: 0.3176,
      },
      {
        startNumber: 100,
        endNumber: 499,
        productPrice: 0.2685,
      },
      {
        startNumber: 500,
        endNumber: 999,
        productPrice: 0.2456,
      },
      {
        startNumber: 1000,
        endNumber: -1,
        productPrice: 0.2325,
      },
    ],
    attributes: [
      {
        attribute_name_en: "Operating Temperature",
        attribute_value_name: "-",
      },
      {
        attribute_name_en: "Number of Positions or Pins",
        attribute_value_name: "1x2P",
      },
      {
        attribute_name_en: "Number of Rows",
        attribute_value_name: "1",
      },
      {
        attribute_name_en: "Voltage Rating (Max)",
        attribute_value_name: "400V",
      },
      {
        attribute_name_en: "Color",
        attribute_value_name: "Gray",
      },
      {
        attribute_name_en: "Number of Pins",
        attribute_value_name: "2P",
      },
      {
        attribute_name_en: "Current Rating",
        attribute_value_name: "32A",
      },
      {
        attribute_name_en: "Pitch",
        attribute_value_name: "-",
      },
      {
        attribute_name_en: "Wire Gauge - mm2",
        attribute_value_name: "0.08~2.5",
      },
      {
        attribute_name_en: "Wire Gauge - AWG",
        attribute_value_name: "12~28",
      },
      {
        attribute_name_en: "Height Above Board",
        attribute_value_name: "14.5mm",
      },
      {
        attribute_name_en: "Mounting Type",
        attribute_value_name: "Free Hanging",
      },
      {
        attribute_name_en: "Number of PINs Per Row",
        attribute_value_name: "2",
      },
    ],
    describe:
      "1 12~28 1x2P 2 2P 32A 400V Free Hanging Gray - Spring Clamp System Terminal Block ROHS",
    componentSpecificationEn: "-",
    componentLibraryType: "expand",
    preferredComponentFlag: false,
  },
  {
    componentTypeEn: "Spring Clamp System Terminal Block",
    componentCode: "C2765052",
    componentModelEn: "222-413",
    componentBrandEn: "WAGO",
    stockCount: 243,
    componentPrices: [
      {
        startNumber: 1,
        endNumber: 9,
        productPrice: 0.5402,
      },
      {
        startNumber: 10,
        endNumber: 29,
        productPrice: 0.4273,
      },
      {
        startNumber: 30,
        endNumber: 99,
        productPrice: 0.3798,
      },
      {
        startNumber: 100,
        endNumber: 499,
        productPrice: 0.3192,
      },
      {
        startNumber: 500,
        endNumber: 999,
        productPrice: 0.2914,
      },
      {
        startNumber: 1000,
        endNumber: -1,
        productPrice: 0.275,
      },
    ],
    attributes: [
      {
        attribute_name_en: "Operating Temperature",
        attribute_value_name: "-",
      },
      {
        attribute_name_en: "Number of Positions or Pins",
        attribute_value_name: "1x3P",
      },
      {
        attribute_name_en: "Number of Rows",
        attribute_value_name: "1",
      },
      {
        attribute_name_en: "Voltage Rating (Max)",
        attribute_value_name: "400V",
      },
      {
        attribute_name_en: "Color",
        attribute_value_name: "Gray",
      },
      {
        attribute_name_en: "Number of Pins",
        attribute_value_name: "3P",
      },
      {
        attribute_name_en: "Current Rating",
        attribute_value_name: "32A",
      },
      {
        attribute_name_en: "Pitch",
        attribute_value_name: "-",
      },
      {
        attribute_name_en: "Wire Gauge - mm2",
        attribute_value_name: "0.08~2.5",
      },
      {
        attribute_name_en: "Wire Gauge - AWG",
        attribute_value_name: "12~28",
      },
      {
        attribute_name_en: "Height Above Board",
        attribute_value_name: "14.5mm",
      },
      {
        attribute_name_en: "Mounting Type",
        attribute_value_name: "Free Hanging",
      },
      {
        attribute_name_en: "Number of PINs Per Row",
        attribute_value_name: "3",
      },
    ],
    describe:
      "1 12~28 1x3P 3 32A 3P 400V Free Hanging Gray - Spring Clamp System Terminal Block ROHS",
    componentSpecificationEn: "-",
    componentLibraryType: "expand",
    preferredComponentFlag: false,
  },
]
