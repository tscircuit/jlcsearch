import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import {
  fetchStepperMotorDrivers,
  normalizeStepperMotorDrivers,
  replaceStepperMotorDrivers,
} from "../scripts/refresh-stepper-motor-drivers"

const product = (id: number, stock = 10) => ({
  componentTypeEn: "Stepper Motor Driver",
  componentCode: `C${id}`,
  componentModelEn: "DRV8825PWPR",
  stockCount: stock,
  componentPrices: [
    { startNumber: 100, productPrice: 1 },
    { startNumber: 1, productPrice: 2 },
  ],
  attributes: [
    { attribute_name_en: "Interface", attribute_value_name: "STEP/DIR" },
    { attribute_name_en: "Output Current", attribute_value_name: "2.5A" },
  ],
})
const pages = (responses: any[]) => {
  let calls = 0
  return (async (_url: any, init: any) => {
    const query = JSON.parse(init.body)
    expect(query.currentPage).toBe(++calls)
    expect(query.firstSortName).toBe("Motor Driver ICs")
    expect(query.secondSortName).toBe("Stepper Motor Driver")
    expect(query.keyword).toBe("")
    return Response.json({
      code: 200,
      data: { componentPageInfo: responses[calls - 1] },
    })
  }) as typeof fetch
}

test("fetches every page, including out-of-stock drivers", async () => {
  const rows = await fetchStepperMotorDrivers(
    pages([
      { total: 3, list: [product(1), product(2)] },
      { total: 3, list: [product(3, 0)] },
    ]),
  )
  expect(rows.map((r) => r.lcsc)).toEqual([1, 2, 3])
  expect(rows[2].in_stock).toBe(0)
  expect(rows[0]).toMatchObject({
    mfr: "DRV8825PWPR",
    price1: 2,
    attributes: JSON.stringify({
      Interface: "STEP/DIR",
      "Output Current": "2.5A",
    }),
  })
})

test("rejects partial, repeated, and changing result sets", async () => {
  for (const second of [
    { total: 2, list: [] },
    { total: 2, list: [product(1)] },
    { total: 3, list: [product(2)] },
  ]) {
    await expect(
      fetchStepperMotorDrivers(
        pages([{ total: 2, list: [product(1)] }, second]),
      ),
    ).rejects.toThrow()
  }
})

test("rejects other motor categories, invalid stock, and all-out-of-stock snapshots", async () => {
  for (const componentTypeEn of [
    "Brushed DC Motor Drivers",
    "Brushless DC (BLDC) Motor Driver",
    "Gate Drivers",
  ]) {
    expect(() =>
      normalizeStepperMotorDrivers({ ...product(1), componentTypeEn }),
    ).toThrow()
  }
  expect(() =>
    normalizeStepperMotorDrivers({ ...product(1), stockCount: null }),
  ).toThrow()
  await expect(
    fetchStepperMotorDrivers(pages([{ total: 1, list: [product(1, 0)] }])),
  ).rejects.toThrow()
})

test("replaces old rows atomically and rolls back an invalid import", () => {
  const db = new Database(":memory:")
  const row = normalizeStepperMotorDrivers(product(1))
  replaceStepperMotorDrivers(db, [row])
  expect(() =>
    replaceStepperMotorDrivers(db, [
      normalizeStepperMotorDrivers(product(2)),
      normalizeStepperMotorDrivers(product(2)),
    ]),
  ).toThrow()
  expect(db.query("SELECT lcsc FROM stepper_motor_driver").all()).toEqual([
    { lcsc: 1 },
  ])
  expect(() => replaceStepperMotorDrivers(db, [])).toThrow()
  replaceStepperMotorDrivers(db, [normalizeStepperMotorDrivers(product(3))])
  expect(db.query("SELECT lcsc FROM stepper_motor_driver").all()).toEqual([
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
    replaceStepperMotorDrivers(db, [
      normalizeStepperMotorDrivers(product(1, 50)),
      normalizeStepperMotorDrivers(product(3, 0)),
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

test("rejects upstream errors and excess rows", async () => {
  await expect(
    fetchStepperMotorDrivers(
      (async (_url: any, _init: any) =>
        new Response("unavailable", { status: 503 })) as typeof fetch,
    ),
  ).rejects.toThrow("JLCPCB HTTP 503")
  await expect(
    fetchStepperMotorDrivers(
      pages([{ total: 1, list: [product(1), product(2)] }]),
    ),
  ).rejects.toThrow("more rows than total")
})
