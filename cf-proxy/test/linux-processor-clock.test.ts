import { describe, expect, it } from "vitest"
import { getD1Client } from "../src/db/get-d1-client"
import { TABLE_CONFIGS, queryTable, type QueryParams } from "../src/handlers"
import { createSelf, createTestEnv } from "./test-env"

const workerTest = "Bun" in globalThis ? it.skip : it

const seed = async (database: D1Database) => {
  await database
    .prepare(`CREATE TABLE linux_capable_processor (
    lcsc INTEGER, mfr TEXT, stock INTEGER, cpu_speed_hz REAL,
    manufacturer TEXT, architecture TEXT, is_preferred BOOLEAN, attributes TEXT
  )`)
    .run()
  await database
    .prepare(`INSERT INTO linux_capable_processor VALUES
    (1, 'below', 100, 1199999999, 'Rockchip', 'ARM64', 1, '{}'),
    (2, 'equal', 90, 1200000000, 'Rockchip', 'ARM64', 1, '{"CPU Maximum Speed":"1.2GHz"}'),
    (3, 'above', 80, 2200000000, 'Rockchip', 'ARM64', 0, '{}'),
    (4, 'unknown', 70, NULL, 'Rockchip', 'ARM64', 1, '{}'),
    (5, 'text', 60, 'unknown', 'Rockchip', 'ARM64', 1, '{}'),
    (6, 'zero', 50, 0, 'Rockchip', 'ARM64', 1, '{}'),
    (7, 'negative', 40, -1, 'Rockchip', 'ARM64', 1, '{}'),
    (8, 'infinite', 30, 1e999, 'Rockchip', 'ARM64', 1, '{}'),
    (9, 'other', 20, 1400000000, 'TI', 'ARM64', 1, '{}'),
    (10, 'unsafe', 10, 9007199254740992, 'Rockchip', 'ARM64', 1, '{}'),
    (11, 'multiple', 5, NULL, 'NXP', 'ARM64', 1, '{"CPU Maximum Speed":"750MHz;1.4GHz"}')`)
    .run()
}

describe("Linux processor minimum rated clock", () => {
  workerTest(
    "filters numeric ratings inclusively with units and existing predicates",
    async () => {
      const { env } = await import("cloudflare:test")
      await seed(env.DB)
      const db = getD1Client(env.DB)
      const query = (params: QueryParams) =>
        queryTable(
          db,
          "linux_capable_processor",
          params,
          TABLE_CONFIGS.linux_capable_processor,
        )
      try {
        for (const value of [
          "1.2GHz",
          "1200MHz",
          "1200000kHz",
          "1200000000Hz",
          "1200000000",
        ]) {
          expect(await query({ cpu_speed_min_hz: value })).toMatchObject([
            { lcsc: 2 },
            { lcsc: 3 },
            { lcsc: 9 },
          ])
        }
        expect(
          await query({
            cpu_speed_min_hz: "1.2GHz",
            manufacturer: "Rockchip",
            architecture: "ARM64",
            is_preferred: "true",
          }),
        ).toMatchObject([{ lcsc: 2 }])
        for (const value of [
          "All",
          "oops",
          "1.2GHz OR 1=1",
          "Infinity",
          "0",
          "-1GHz",
          " ",
          "1e99",
          "1GHz;2GHz",
        ]) {
          expect(await query({ cpu_speed_min_hz: value })).toEqual([])
        }
        expect(await query({ cpu_speed_min_hz: "2.3GHz" })).toEqual([])
        expect(await query({})).toHaveLength(11)
        expect(await query({ cpu_speed_min_hz: "" })).toHaveLength(11)
      } finally {
        await db.destroy()
      }
    },
  )

  workerTest(
    "roundtrips the HTML filter and JSON link and restores every row when cleared",
    async () => {
      const { env: fixtureEnv } = await import("cloudflare:test")
      await seed(fixtureEnv.DB)
      const env = createTestEnv()
      env.USE_D1 = "true"
      env.DB = fixtureEnv.DB
      const self = createSelf(env)
      try {
        const params = new URLSearchParams({
          cpu_speed_min_hz: "1.2 GHz",
          manufacturer: "Rockchip",
          is_preferred: "true",
        })
        const response = await self.fetch(
          `https://example.com/linux_capable_processors/list?${params}`,
        )
        expect(response.status).toBe(200)
        const html = await response.text()
        expect(html).toContain('name="cpu_speed_min_hz" value="1.2 GHz"')
        expect(html).toContain('name="manufacturer" value="Rockchip"')
        expect(html).toContain("Min Rated CPU Clock")
        expect(html).toContain("Rated Max CPU Clock")
        expect(html).toContain("1.2GHz")
        const jsonLink = html
          .match(
            /href="([^"]*\/linux_capable_processors\/list\.json\?[^"]*)"/,
          )![1]
          .replaceAll("&amp;", "&")
        const jsonUrl = new URL(jsonLink, "https://example.com")
        expect(jsonUrl.searchParams.get("cpu_speed_min_hz")).toBe("1.2 GHz")
        const json = await self.fetch(jsonUrl.href)
        expect(json.status).toBe(200)
        const result = await json.json<{
          linux_capable_processors: Array<{
            lcsc: number
            cpu_speed_hz: number
          }>
        }>()
        expect(result.linux_capable_processors.map((row) => row.lcsc)).toEqual([
          2,
        ])
        expect(result.linux_capable_processors[0].cpu_speed_hz).toBe(1.2e9)
        const clearLink = html.match(/href="([^"]*)">Clear filters<\/a>/)![1]
        expect(clearLink).toBe("/linux_capable_processors/list")
        const cleared = await (
          await self.fetch(`https://example.com${clearLink}`)
        ).text()
        expect(cleared).toContain('name="cpu_speed_min_hz" value=""')
        expect(cleared).toContain("750MHz;1.4GHz")
        expect(cleared).toContain("Unknown")
        expect(
          cleared.match(/<tbody>.*?<\/tbody>/s)![0].match(/<tr>/g),
        ).toHaveLength(11)
        const invalid = await self.fetch(
          "https://example.com/linux_capable_processors/list.json?cpu_speed_min_hz=1.2GHzjunk",
        )
        expect(await invalid.json()).toEqual({ linux_capable_processors: [] })
      } finally {
        await self.flushWaitUntil()
      }
    },
  )
})
