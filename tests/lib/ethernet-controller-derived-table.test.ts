import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { ethernetControllerTableSpec as spec } from "lib/db/derivedtables/ethernet-controller"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const component = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 1,
    mfr: "W5500",
    description: "",
    package: "LQFP-48",
    stock: 100,
    price: JSON.stringify([{ qFrom: 1, price: 2.5 }]),
    basic: 0,
    preferred: 1,
    extra: null,
    ...overrides,
  }) as any

test("includes requested controllers with missing or malformed metadata and suffixes", () => {
  for (const mfr of ["W5500", "CH390H", "ENC28J60-I/SO"]) {
    for (const extra of [
      null,
      "{invalid",
      "null",
      JSON.stringify({ attributes: {} }),
    ]) {
      expect(spec.mapToTable([component({ mfr, extra })])[0]).toMatchObject({
        mfr,
        package: "LQFP-48",
        stock: 100,
        price1: 2.5,
        in_stock: true,
        is_basic: false,
        is_preferred: true,
      })
    }
  }
})

test("keeps other controllers but excludes PHY, PoE, connectors, modules and prefix collisions", () => {
  const fixtures = [
    component({ mfr: "OTHER", source_subcategory: "Ethernet Controllers" }),
    component({
      mfr: "OTHER",
      description: "Ethernet Controller with integrated PHY",
    }),
    component({ mfr: "LAN8720A", description: "Ethernet Transceivers" }),
    component({
      mfr: "TPS2375",
      description: "Power Over Ethernet Controllers",
    }),
    component({ description: "W5500 Ethernet module" }),
    component({ mfr: "RJ45", description: "Ethernet connector" }),
    component({ mfr: "W55000" }),
    component({
      mfr: "OTHER",
      source_subcategory: "Ethernet Controllers",
      description: "PHY transceiver",
    }),
  ]
  expect(spec.mapToTable(fixtures).map(Boolean)).toEqual([
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
  ])
  expect(spec.mapToTable([component({ stock: 0 })])[0]?.in_stock).toBe(false)
})

test("selects and populates controllers from dedicated and mixed upstream categories", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  try {
    database.exec(`CREATE TABLE categories (id INTEGER PRIMARY KEY, subcategory TEXT);
      CREATE TABLE components (lcsc INTEGER PRIMARY KEY, category_id INTEGER, mfr TEXT, description TEXT, package TEXT, stock INTEGER, price TEXT, basic INTEGER, preferred INTEGER, extra TEXT);`)
    await db
      .insertInto("categories")
      .values([
        { id: 1, subcategory: "Ethernet ICs" },
        { id: 2, subcategory: "Ethernet Controllers" },
      ])
      .execute()
    await db
      .insertInto("components")
      .values([
        component({ category_id: 1 }),
        component({ lcsc: 2, category_id: 1, mfr: "CH390H" }),
        component({ lcsc: 3, category_id: 1, mfr: "ENC28J60-I/SO" }),
        component({ lcsc: 4, category_id: 2, mfr: "OTHER" }),
        component({
          lcsc: 5,
          category_id: 1,
          mfr: "LAN8720A",
          description: "Ethernet Transceiver",
        }),
        component({
          lcsc: 6,
          category_id: 1,
          mfr: "TPS2375",
          description: "Power Over Ethernet Controllers",
        }),
      ])
      .execute()
    await setupDerivedTables({ db, tableNames: ["ethernet_controller"] })
    expect(
      (
        await db
          .selectFrom("ethernet_controller")
          .select("lcsc")
          .orderBy("lcsc")
          .execute()
      ).map((c) => c.lcsc),
    ).toEqual([1, 2, 3, 4])
    const migration = await Bun.file(
      new URL(
        "../../cf-proxy/migrations/0015_ethernet_controller.sql",
        import.meta.url,
      ),
    ).text()
    database.exec(migration)
    database.exec(migration)
    const columns = database
      .query("PRAGMA table_info(ethernet_controller)")
      .all()
      .map((column: any) => ({ ...column, type: column.type.toUpperCase() }))
    const migrated = new Database(":memory:")
    try {
      migrated.exec(migration)
      expect(
        migrated
          .query("PRAGMA table_info(ethernet_controller)")
          .all()
          .map((column: any) => ({
            ...column,
            type: column.type.toUpperCase(),
          })),
      ).toEqual(columns)
      expect(
        migrated
          .query(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ethernet_controller'",
          )
          .all(),
      ).toHaveLength(4)
    } finally {
      migrated.close()
    }
  } finally {
    await db.destroy()
  }
})
