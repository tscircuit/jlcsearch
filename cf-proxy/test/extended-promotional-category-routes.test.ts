import {
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
} from "kysely"
import { describe, expect, it } from "vitest"
import { getD1Handler } from "../src/d1-routes"
import type { DB } from "../src/db/types"
import {
  normalizeTableQueryParams,
  ROUTE_TO_TABLE,
  TABLE_CONFIGS,
  TABLE_RESPONSE_KEY,
  type QueryParams,
} from "../src/handlers"

const createDb = (rows: Record<string, unknown>[] = []) => {
  const queries: CompiledQuery[] = []
  const driver = new DummyDriver()
  driver.acquireConnection = async () =>
    ({
      executeQuery: async (query: CompiledQuery) => {
        queries.push(query)
        return {
          rows:
            query.sql.startsWith("SELECT * FROM") ||
            query.sql.startsWith('select "lcsc"')
              ? rows
              : [],
        }
      },
      streamQuery: async function* () {},
    }) as DatabaseConnection
  const db = new Kysely<DB>({
    dialect: {
      createAdapter: () => new SqliteAdapter(),
      createDriver: () => driver,
      createIntrospector: (database) => new SqliteIntrospector(database),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  })
  return { db, queries }
}

describe("extended promotional category alias", () => {
  it.each(Object.entries(ROUTE_TO_TABLE))(
    "%s uses its existing preferred column with canonical precedence",
    async (route, tableName) => {
      const { db, queries } = createDb([
        { lcsc: 1, is_basic: 1, is_preferred: 0 },
      ])
      try {
        const config = TABLE_CONFIGS[tableName]
        expect(config.filters.is_extended_promotional).toEqual({
          field: "is_preferred",
          type: "boolean",
        })
        expect(config.filters.is_preferred).toBeUndefined()
        expect(config.paramAliases?.is_preferred).toBe(
          "is_extended_promotional",
        )
        const result = await getD1Handler(route)!(db, {
          is_extended_promotional: "false",
          is_preferred: "true",
        })
        const query = queries.find((q) => q.sql.startsWith("SELECT * FROM"))!
        expect(query.sql).toContain('WHERE "is_preferred" = ?')
        expect(query.sql).not.toContain('"is_extended_promotional"')
        expect(query.sql).not.toContain('"is_basic" =')
        expect(query.sql).not.toContain('"is_preferred" IS NULL')
        expect(query.parameters).toEqual([0])
        expect(result.data[TABLE_RESPONSE_KEY[tableName]]).toEqual([
          {
            lcsc: 1,
            is_basic: true,
            is_preferred: false,
            is_extended_promotional: false,
          },
        ])
      } finally {
        await db.destroy()
      }
    },
  )

  it.each([
    [{ is_extended_promotional: "true" }, 1],
    [{ is_extended_promotional: "1" }, 1],
    [{ is_extended_promotional: "false" }, 0],
    [{ is_extended_promotional: "0" }, 0],
    [{ is_preferred: "true" }, 1],
    [{ is_preferred: "1" }, 1],
    [{ is_preferred: "false" }, 0],
    [{ is_preferred: "0" }, 0],
    [{ is_preferred: "yes" }, 0],
    [{ is_preferred: "TRUE" }, 0],
    [{ is_preferred: " true " }, 0],
    [{ is_preferred: " " }, 0],
    [{ is_preferred: "null" }, 0],
    [{ is_preferred: "2" }, 0],
    [{ is_preferred: "" }, null],
    [{ is_preferred: "All" }, null],
    [{ is_extended_promotional: "true", is_preferred: "yes" }, 1],
    [{ is_extended_promotional: "invalid", is_preferred: "yes" }, null],
    [{ is_extended_promotional: "true", is_preferred: "false" }, 1],
    [{ is_extended_promotional: "0", is_preferred: "1" }, 0],
    [{ is_extended_promotional: "", is_preferred: "true" }, null],
    [{ is_extended_promotional: "invalid", is_preferred: "true" }, null],
    [{ is_extended_promotional: "All", is_preferred: "true" }, null],
  ] as [QueryParams, number | null][])(
    "normalizes category parameters %j to %s",
    async (params, expected) => {
      const { db, queries } = createDb()
      try {
        await getD1Handler("/resistors/list")!(db, params)
        const query = queries.find((q) => q.sql.startsWith("SELECT * FROM"))!
        expect(query.parameters).toEqual(expected === null ? [] : [expected])
        expect(query.sql.includes('"is_preferred" = ?')).toBe(expected !== null)
      } finally {
        await db.destroy()
      }
    },
  )

  it("retains other parameter aliases and does not invent missing catalog flags", async () => {
    const input = { wavelength_min: "355", is_preferred: "true" }
    expect(normalizeTableQueryParams("photo_diode", input)).toEqual({
      ...input,
      wavelength: "355",
      is_extended_promotional: "true",
    })
    expect(input).toEqual({ wavelength_min: "355", is_preferred: "true" })
    const { db } = createDb([
      { lcsc: 1, is_basic: 1, is_preferred: 1 },
      { lcsc: 2, is_preferred: null },
      { lcsc: 3 },
    ])
    try {
      const result = await getD1Handler("/resistors/list")!(db, {})
      expect(result.data.resistors).toEqual([
        {
          lcsc: 1,
          is_basic: true,
          is_preferred: true,
          is_extended_promotional: true,
        },
        { lcsc: 2, is_preferred: null, is_extended_promotional: null },
        { lcsc: 3 },
      ])
    } finally {
      await db.destroy()
    }
  })
})

describe.each(["/lcd_drivers/list", "/tft_display_drivers/list"])(
  "%s promotional filtering",
  (route) => {
    it.each([
      [{ is_extended_promotional: "true" }, 1],
      [{ is_extended_promotional: "1" }, 1],
      [{ is_extended_promotional: "false" }, 0],
      [{ is_extended_promotional: "0" }, 0],
      [{ is_extended_promotional: "true", is_preferred: "false" }, 1],
      [{ is_extended_promotional: "false", is_preferred: "true" }, 0],
      [{ is_extended_promotional: "", is_preferred: "true" }, null],
      [{ is_extended_promotional: "invalid", is_preferred: "true" }, null],
      [{ is_preferred: "true" }, 1],
      [{ is_preferred: "1" }, 1],
      [{ is_preferred: "false" }, null],
      [{ is_preferred: "0" }, null],
      [{}, null],
    ] as [QueryParams, number | null][])(
      "compiles %j with preferred condition %s",
      async (params, expected) => {
        const { db, queries } = createDb()
        try {
          await getD1Handler(route)!(db, params)
          const query = queries.find((q) => q.sql.startsWith('select "lcsc"'))!
          expect(query.sql.includes('"preferred" = ?')).toBe(expected !== null)
          expect(query.sql).not.toContain('"is_extended_promotional"')
          expect(query.sql).not.toContain('"basic" =')
          expect(query.sql.includes('"preferred" is null')).toBe(expected === 0)
          if (expected !== null) expect(query.parameters.at(-1)).toBe(expected)
        } finally {
          await db.destroy()
        }
      },
    )

    it("serializes the same boolean under both names, including a basic preferred row", async () => {
      const { db } = createDb([
        { lcsc: 1, mfr: "HT1621B", basic: 1, preferred: 1 },
        { lcsc: 2, mfr: "HT1622", basic: 0, preferred: 0 },
        { lcsc: 3, mfr: "HT1622", basic: 0, preferred: null },
      ])
      try {
        const result = await getD1Handler(route)!(db, {})
        const rows = Object.values(result.data)[0] as Record<string, unknown>[]
        expect(rows[0]).toMatchObject({
          is_basic: true,
          is_preferred: true,
          is_extended_promotional: true,
        })
        expect(rows[1]).toMatchObject({
          is_basic: false,
          is_preferred: false,
          is_extended_promotional: false,
        })
        expect(rows[2]).toMatchObject({
          is_preferred: false,
          is_extended_promotional: false,
        })
      } finally {
        await db.destroy()
      }
    })
  },
)
