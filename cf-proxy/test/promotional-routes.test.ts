import { env } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import { createSelf, createTestEnv } from "./test-env"
import { promotionalFixtureSql } from "./promotional-fixture"

declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database
  }
}

describe("promotional filtering against local D1", () => {
  const testEnv = createTestEnv()
  const self = createSelf(testEnv)
  beforeEach(async () => {
    testEnv.USE_D1 = "true"
    testEnv.DB = env.DB
    for (const key of (await testEnv.CACHE_KV.list()).keys)
      await testEnv.CACHE_KV.delete(key.name)
    await env.DB.batch(
      promotionalFixtureSql
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean)
        .map((sql) => env.DB.prepare(sql)),
    )
  })

  for (const [route, key] of [
    ["/api/search", "components"],
    ["/components/list", "components"],
    ["/lcd_drivers/list", "lcd_drivers"],
    ["/tft_display_drivers/list", "tft_display_drivers"],
    ["/resistors/list", "resistors"],
    ["/arm_processors/list", "arm_processors"],
    ["/risc_v_processors/list", "risc_v_processors"],
    ["/analog_switches/list", "switches"],
    ["/microphones/list", "microphones"],
  ]) {
    it(`${route} returns real boolean status and applies catalog filters`, async () => {
      const read = async (query: string) => {
        const response = await self.fetch(
          `https://example.com${route}?json=true&${query}`,
          { headers: { accept: "application/json" } },
        )
        expect(response.status).toBe(200)
        return (
          (await response.json()) as Record<
            string,
            Array<Record<string, unknown>>
          >
        )[key]
      }
      const all = await read("")
      expect(all.length).toBeGreaterThan(1)
      expect(all.some((row) => row.is_extended_promotional === true)).toBe(true)
      expect(all.some((row) => row.is_extended_promotional === false)).toBe(
        true,
      )
      for (const flag of ["true", "1", "false", "0"]) {
        const rows = await read(`is_extended_promotional=${flag}`)
        expect(rows.length).toBeGreaterThan(0)
        expect(
          rows.every(
            (row) =>
              row.is_extended_promotional === (flag === "true" || flag === "1"),
          ),
        ).toBe(true)
      }
      if (
        [
          "components",
          "lcd_drivers",
          "tft_display_drivers",
          "resistors",
        ].includes(key)
      ) {
        expect(
          await read("is_basic=true&is_extended_promotional=true"),
        ).toEqual([])
      }
      expect(all.every((row) => Number(row.stock) > 0)).toBe(true)
    })
  }

  it("filters category status before the result limit using the catalog index", async () => {
    await env.DB.prepare(
      "WITH RECURSIVE n(x) AS (VALUES(1000) UNION ALL SELECT x+1 FROM n WHERE x<1199) INSERT INTO resistor SELECT x,'Ordinary',1000,'0603',1000,0,0 FROM n",
    ).run()
    const response = await self.fetch(
      "https://example.com/resistors/list.json?package=0603&is_extended_promotional=true",
      { headers: { accept: "application/json" } },
    )
    expect(response.status).toBe(200)
    expect(
      ((await response.json()) as any).resistors.map((row: any) => row.lcsc),
    ).toEqual([1])
    const plan = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT resistor.lcsc FROM resistor INNER JOIN component_catalog AS promotional_catalog ON promotional_catalog.lcsc=resistor.lcsc WHERE resistor.package='0603' AND promotional_catalog.is_extended_promotional=1 ORDER BY resistor.stock DESC LIMIT 100",
    ).all()
    expect(
      plan.results.some((row: any) =>
        row.detail.includes("idx_resistor_package_stock"),
      ),
    ).toBe(true)
    expect(
      plan.results.some((row: any) =>
        row.detail.includes("sqlite_autoindex_component_catalog_1"),
      ),
    ).toBe(true)
  })

  it("filters promotional text search through LIKE and FTS paths", async () => {
    const read = () =>
      self.fetch(
        "https://example.com/api/search?q=driver&is_extended_promotional=1&cachebust=1",
        { headers: { accept: "application/json" } },
      )
    expect(
      ((await (await read()).json()) as any).components.map(
        (row: any) => row.lcsc,
      ),
    ).toEqual([1, 4])
    await env.DB.batch([
      env.DB.prepare(
        "CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text)",
      ),
      env.DB.prepare(
        "INSERT INTO search_index_fts(rowid,search_text) SELECT rowid,search_text FROM search_index",
      ),
      env.DB.prepare(
        "CREATE TABLE search_index_fts_meta(key TEXT, value TEXT)",
      ),
      env.DB.prepare("INSERT INTO search_index_fts_meta VALUES ('ready','1')"),
    ])
    expect(
      ((await (await read()).json()) as any).components.map(
        (row: any) => row.lcsc,
      ),
    ).toEqual([1, 4])
  })

  it("renders selected Yes and No filters and named columns on catalog pages", async () => {
    for (const route of [
      "/components/list",
      "/lcd_drivers/list",
      "/tft_display_drivers/list",
    ]) {
      const response = await self.fetch(
        `https://example.com${route}?is_extended_promotional=1`,
        { headers: { accept: "text/html" } },
      )
      const html = await response.text()
      expect(response.status).toBe(200)
      expect(html).toContain('<option value="true" selected>Yes</option>')
      expect(html).toContain("Extended Promotional")
      const excluded = await self.fetch(
        `https://example.com${route}?is_extended_promotional=0`,
        { headers: { accept: "text/html" } },
      )
      expect(await excluded.text()).toContain(
        '<option value="false" selected>No</option>',
      )
    }
  })
})
