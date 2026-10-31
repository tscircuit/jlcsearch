import { describe, expect, it } from "vitest"
import type { Kysely } from "kysely"
import type { DB } from "../src/db/types"
import { getD1Client } from "../src/db/get-d1-client"
import { queryTable, TABLE_CONFIGS, type QueryParams } from "../src/handlers"
import { createSelf, createTestEnv } from "./test-env"

const workerTest = "Bun" in globalThis ? it.skip : it

const query = (db: Kysely<DB>, params: QueryParams) =>
  queryTable(db, "microcontroller", params, TABLE_CONFIGS.microcontroller)

const seedDatabase = (db: D1Database, sql: string) =>
  db.batch(
    sql
      .split(";")
      .filter((statement) => statement.trim())
      .map((statement) => db.prepare(statement)),
  )

describe.each([
  "has_usb",
  "has_usb_host",
  "has_can",
  "has_spi",
  "has_i2c",
  "has_uart",
])("microcontroller %s filter", (field) => {
  it.each(["true", "false", ""])(
    "filters HTML and JSON with %s",
    async (value) => {
      const env = createTestEnv()
      const self = createSelf(env)
      const queries: Array<{ sql: string; parameters: unknown[] }> = []
      env.USE_D1 = "true"
      env.DB = {
        prepare: (sql: string) => ({
          bind: (...parameters: unknown[]) => ({
            all: async () => {
              if (sql.startsWith('SELECT * FROM "microcontroller"')) {
                queries.push({ sql, parameters })
                return {
                  results: [
                    { lcsc: 2040, mfr: "RP2040", [field]: 1, stock: 123 },
                  ],
                  meta: {},
                }
              }
              return { results: [], meta: {} }
            },
          }),
        }),
      } as unknown as D1Database
      try {
        const params = `${field}=${value}&package=QFN&core=ARM-M0&flash_min=32&ram_min=16`
        const response = await self.fetch(
          `https://example.com/microcontrollers/list?${params}`,
        )
        expect(response.status).toBe(200)
        const html = await response.text()
        expect(html).toContain("Has USB")
        expect(html).toContain(`select name="${field}"`)
        if (value) expect(html).toContain(`value="${value}" selected`)
        expect(html).toContain(
          `/microcontrollers/list.json?${field}=${value}&amp;package=QFN`,
        )
        const json = await self.fetch(
          `https://example.com/microcontrollers/list.json?${params}`,
        )
        expect(json.status).toBe(200)
        expect(await json.json()).toMatchObject({
          microcontrollers: [{ [field]: true }],
        })
        expect(queries).toHaveLength(2)
        for (const query of queries) {
          if (value) {
            expect(query.sql).toContain(`"${field}" = ?`)
            expect(query.parameters).toEqual([
              "QFN",
              value === "true" ? 1 : 0,
              "ARM-M0",
              32,
              16,
            ])
          } else {
            expect(query.sql).not.toContain(`"${field}" =`)
            expect(query.parameters).toEqual(["QFN", "ARM-M0", 32, 16])
          }
        }
      } finally {
        await self.flushWaitUntil()
      }
    },
  )
})

describe("minimum rated MCU clock", () => {
  workerTest(
    "roundtrips units through the GET form and JSON link, and clears the filter",
    async () => {
      const env = createTestEnv()
      const self = createSelf(env)
      const { env: fixtureEnv } = await import("cloudflare:test")
      env.USE_D1 = "true"
      env.DB = fixtureEnv.DB
      await seedDatabase(
        env.DB,
        `CREATE TABLE microcontroller (
      lcsc INTEGER, mfr TEXT, cpu_speed_hz REAL, stock INTEGER, has_usb BOOLEAN
    );
    INSERT INTO microcontroller VALUES
      (8734, 'STM32F103C8T6', 72000000, 100, 1),
      (52717, 'STM8S003F3P6TR', 16000000, 90, 1);
    CREATE TABLE resistor (lcsc INTEGER, stock INTEGER);`,
      )
      try {
        const params = new URLSearchParams({
          cpu_speed_min_hz: "72 MHz",
          has_usb: "true",
        })
        const html = await (
          await self.fetch(
            `https://example.com/microcontrollers/list?${params}`,
          )
        ).text()
        expect(html).toContain("Min Rated CPU Clock")
        expect(html).toContain('name="cpu_speed_min_hz" value="72 MHz"')
        expect(html).toContain("Listed maximum CPU clock")
        expect(html).toContain("Rated Max CPU Clock")
        expect(html).toContain("72MHz")
        const jsonLink = html
          .match(/href="([^"]*\/microcontrollers\/list\.json\?[^"]*)"/)![1]
          .replaceAll("&amp;", "&")
        expect(
          new URL(jsonLink, "https://example.com").searchParams.get(
            "cpu_speed_min_hz",
          ),
        ).toBe("72 MHz")
        const json = await self.fetch(
          new URL(jsonLink, "https://example.com").href,
        )
        expect(await json.json()).toMatchObject({
          microcontrollers: [{ cpu_speed_hz: 72000000 }],
        })
        expect(html).not.toContain("STM8S003F3P6TR")
        const clearLink = html.match(/href="([^"]*)">Clear filters<\/a>/)![1]
        const cleared = await (
          await self.fetch(`https://example.com${clearLink}`)
        ).text()
        expect(cleared).toContain('name="cpu_speed_min_hz" value=""')
        expect(cleared).toContain("STM8S003F3P6TR")
        const invalid = await self.fetch(
          "https://example.com/microcontrollers/list.json?cpu_speed_min_hz=72MHzjunk",
        )
        expect(await invalid.json()).toMatchObject({ microcontrollers: [] })
        const otherCategory = await (
          await self.fetch(
            "https://example.com/resistors/list?cpu_speed_min_hz=72MHz",
          )
        ).text()
        expect(otherCategory).not.toContain('name="cpu_speed_min_hz"')
      } finally {
        await self.flushWaitUntil()
      }
    },
  )
})

workerTest(
  "minimum rating includes equality, intersects filters, and excludes unknown or invalid storage",
  async () => {
    const { env } = await import("cloudflare:test")
    const database = env.DB
    await seedDatabase(
      database,
      `CREATE TABLE microcontroller (
    lcsc INTEGER, stock INTEGER, cpu_speed_hz REAL, package TEXT, has_usb BOOLEAN
  );
  INSERT INTO microcontroller VALUES
    (1, 100, 71999999, 'QFN', 1),
    (2, 90, 72000000, 'QFN', 1),
    (3, 80, 133000000, 'QFN', 0),
    (4, 70, NULL, 'QFN', 1),
    (5, 60, 'unknown', 'QFN', 1),
    (6, 50, 0, 'QFN', 1),
    (7, 40, -1, 'QFN', 1),
    (8, 30, 1e999, 'QFN', 1),
    (9, 20, 96000000, 'DIP', 1);
  CREATE TABLE resistor (lcsc INTEGER, stock INTEGER);
  INSERT INTO resistor VALUES (10, 100);`,
    )
    const db = getD1Client(database)
    try {
      for (const threshold of ["72MHz", "72000kHz", "72000000Hz", "72000000"]) {
        expect(await query(db, { cpu_speed_min_hz: threshold })).toMatchObject([
          { lcsc: 2 },
          { lcsc: 3 },
          { lcsc: 9 },
        ])
      }
      expect(
        await query(db, {
          cpu_speed_min_hz: "72MHz",
          package: "QFN",
          has_usb: "true",
        }),
      ).toMatchObject([{ lcsc: 2 }])
      expect(await query(db, { cpu_speed_min_hz: "133000001" })).toEqual([])
      for (const threshold of [
        "All",
        "oops",
        "72MHz OR 1=1",
        "Infinity",
        "-1",
        "0",
        " ",
        "1e99",
      ]) {
        expect(await query(db, { cpu_speed_min_hz: threshold })).toEqual([])
      }
      expect(await query(db, {})).toHaveLength(9)
      expect(await query(db, { cpu_speed_min_hz: "" })).toHaveLength(9)
      expect(
        await queryTable(
          db,
          "resistor",
          { cpu_speed_min_hz: "72MHz" },
          TABLE_CONFIGS.resistor,
        ),
      ).toMatchObject([{ lcsc: 10 }])
    } finally {
      await db.destroy()
    }
  },
)
