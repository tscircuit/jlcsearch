import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { BASE_COMPONENT_COLUMNS } from "lib/db/derivedtables/component-base"
import {
  DERIVED_TABLES,
  setupDerivedTables,
} from "lib/db/derivedtables/setup-derived-tables"
import { D1_ROUTES, getD1Handler } from "../../cf-proxy/src/d1-routes"
import {
  BASE_COMPONENT_FILTERS,
  ROUTE_TO_TABLE,
  TABLE_CONFIGS,
} from "../../cf-proxy/src/handlers"
import { renderD1TablePage } from "../../cf-proxy/src/render"

test("all derived tables create base component columns including is_basic and is_preferred", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await setupDerivedTables({ db, populate: false })

    const requiredColumns = [
      ...BASE_COMPONENT_COLUMNS.map((col) => col.name),
      "attributes",
    ]

    for (const spec of DERIVED_TABLES) {
      const columns = database
        .query(`PRAGMA table_info(${spec.tableName})`)
        .all() as Array<{ name: string }>
      const columnNames = columns.map((c) => c.name)

      for (const requiredCol of requiredColumns) {
        expect(columnNames).toContain(requiredCol)
      }
    }
  } finally {
    await db.destroy()
  }
})

test("all component table configs and routes expose global is_basic and is_preferred filters", () => {
  for (const [, config] of Object.entries(TABLE_CONFIGS)) {
    expect(config.filters.is_basic).toEqual(BASE_COMPONENT_FILTERS.is_basic)
    expect(config.filters.is_preferred).toEqual(
      BASE_COMPONENT_FILTERS.is_preferred,
    )
  }

  for (const pathname of Object.keys(ROUTE_TO_TABLE)) {
    const html = renderD1TablePage(pathname, {}, {})
    expect(html).toContain('name="is_basic"')
    expect(html).toContain('name="is_preferred"')
  }

  for (const specialRoute of [
    "/analog_switches/list",
    "/arm_processors/list",
    "/risc_v_processors/list",
    "/microphones/list",
    "/lcd_drivers/list",
    "/tft_display_drivers/list",
  ]) {
    expect(D1_ROUTES).toContain(specialRoute)
    const html = renderD1TablePage(specialRoute, {}, {})
    expect(html).toContain('name="is_basic"')
    expect(html).toContain('name="is_preferred"')
  }
})

test("previously missing component routes filter by is_basic and is_preferred", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await setupDerivedTables({
      db,
      populate: false,
      tableNames: ["led"],
    })

    database.exec(`
      INSERT INTO led (
        lcsc, mfr, description, stock, price1, in_stock, is_basic, is_preferred, package, color, attributes
      ) VALUES
        (101, 'LED-BASIC', 'Basic Red LED', 500, 0.01, 1, 1, 0, '0603', 'red', '{}'),
        (102, 'LED-PREF', 'Preferred Green LED', 400, 0.02, 1, 0, 1, '0603', 'green', '{}');
    `)

    const handler = getD1Handler("/leds/list")
    expect(handler).not.toBeNull()

    const basicOnly = await handler!(db as any, { is_basic: "true" })
    expect(basicOnly.data.leds).toHaveLength(1)
    expect((basicOnly.data.leds[0] as any).lcsc).toBe(101)
    expect((basicOnly.data.leds[0] as any).is_basic).toBe(true)
    expect((basicOnly.data.leds[0] as any).is_preferred).toBe(false)

    const preferredOnly = await handler!(db as any, { is_preferred: "true" })
    expect(preferredOnly.data.leds).toHaveLength(1)
    expect((preferredOnly.data.leds[0] as any).lcsc).toBe(102)
    expect((preferredOnly.data.leds[0] as any).is_basic).toBe(false)
    expect((preferredOnly.data.leds[0] as any).is_preferred).toBe(true)
  } finally {
    await db.destroy()
  }
})
