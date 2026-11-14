import { describe, expect, it } from "vitest"
import worker from "../src/index"

// Bun runs the SQLite query regressions; this suite needs workerd's D1 binding.
// The Bun Test workflow also runs this file with the Cloudflare Vitest pool.
const workerTest = "Bun" in globalThis ? it.skip : it

describe("search API contract against seeded D1", () => {
  workerTest.each([
    "legacy",
    "disabled",
    "missing-metadata",
    "missing-index",
    "stable",
  ] as const)(
    "protects text search and preserves exact lookups with a %s FTS index",
    async (indexVersion) => {
      const { env } = await import("cloudflare:test")
      await env.DB.prepare(`CREATE TABLE search_index (
        lcsc INTEGER UNIQUE, mfr TEXT, package TEXT, description TEXT,
        stock INTEGER, price TEXT, price1 REAL, basic INTEGER, preferred INTEGER,
        category TEXT, subcategory TEXT, search_text TEXT
      )`).run()
      await env.DB.prepare(`INSERT INTO search_index
        (rowid,lcsc,mfr,package,description,stock,price1,basic,preferred,search_text)
        VALUES
          (100,12345,'STM32F401RCT6','LQFP-64','ARM microcontroller',50,2.5,0,1,'stm32f401rct6 arm microcontroller'),
          (200,42388007,'RK3576','FCCSP-698L(16.1x17.2)','Rockchip processor',487,22.5,0,0,'rockchip rk3576 processor'),
          (300,54321,'SMBJ6.5CA','DO-214AA','TVS diode',1000,0.1,1,0,'tvs diode smbj6.5ca')`).run()
      await env.DB.prepare(`CREATE TABLE _jlcsearch_requested_parts (
        lcsc INTEGER PRIMARY KEY, requested_at INTEGER NOT NULL,
        attempted_at INTEGER DEFAULT 0, verified_at INTEGER,
        component_json TEXT, last_error TEXT
      )`).run()
      await env.DB.prepare(
        "CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram')",
      ).run()
      await env.DB.prepare(
        "CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)",
      ).run()
      if (indexVersion === "legacy") {
        // A previously rebuilt catalog can have different rowids from its FTS index.
        await env.DB.prepare(`INSERT INTO search_index_fts(rowid,search_text)
          VALUES (300,'stm32f401rct6'),(100,'rk3576')`).run()
        await env.DB.prepare(
          "INSERT INTO search_index_fts_meta VALUES ('ready','1')",
        ).run()
      } else {
        await env.DB.prepare(`INSERT INTO search_index_fts(rowid,search_text)
          SELECT lcsc,search_text FROM search_index`).run()
        await env.DB.prepare(
          "INSERT INTO search_index_fts_meta VALUES ('ready_lcsc','1')",
        ).run()
        await env.DB.prepare(
          "UPDATE search_index SET rowid=400 WHERE lcsc=42388007",
        ).run()
      }

      if (indexVersion === "disabled") {
        await env.DB.prepare(
          "UPDATE search_index_fts_meta SET value='0' WHERE key='ready_lcsc'",
        ).run()
      } else if (indexVersion === "missing-metadata") {
        await env.DB.prepare("DROP TABLE search_index_fts_meta").run()
      } else if (indexVersion === "missing-index") {
        await env.DB.prepare("DROP TABLE search_index_fts").run()
      }

      const fetchSearch = async (query: string) => {
        const pending: Promise<unknown>[] = []
        const response = await worker.fetch(
          new Request(`https://example.com/api/search?${query}&cachebust=1`),
          { ...env, USE_D1: "true" },
          { waitUntil: (p: Promise<unknown>) => pending.push(p) } as any,
        )
        await Promise.all(pending)
        return response
      }
      const request = async (query: string) => {
        const response = await fetchSearch(query)
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        )
        return (await response.json()) as {
          components: Record<string, unknown>[]
        }
      }

      if (indexVersion !== "stable") {
        const unavailable = await fetchSearch("q=RK3576")
        expect(unavailable.status).toBe(503)
        expect(unavailable.headers.get("retry-after")).toBe("60")
        expect(unavailable.headers.get("cache-control")).toBe("no-store")
        expect(await unavailable.json()).toMatchObject({
          error_code: "search_unavailable",
        })
        expect((await request("q=C42388007")).components).toMatchObject([
          { lcsc: 42388007, mfr: "RK3576", stock: 487 },
        ])

        // Simulate a completed, validated rebuild in the local D1 binding.
        if (indexVersion === "missing-index") {
          await env.DB.prepare(
            "CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram')",
          ).run()
        }
        if (indexVersion === "missing-metadata") {
          await env.DB.prepare(
            "CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)",
          ).run()
        }
        await env.DB.prepare("DELETE FROM search_index_fts").run()
        await env.DB.prepare(`INSERT INTO search_index_fts(rowid,search_text)
          SELECT lcsc,search_text FROM search_index`).run()
        await env.DB.prepare(
          "INSERT OR REPLACE INTO search_index_fts_meta VALUES ('ready_lcsc','1')",
        ).run()
      }

      // The same requests resume automatically once the rebuilt index is ready.
      expect((await request("q=STM32F401RCT6")).components).toEqual([
        {
          lcsc: 12345,
          mfr: "STM32F401RCT6",
          package: "LQFP-64",
          description: "ARM microcontroller",
          stock: 50,
          price: 2.5,
          is_basic: false,
          is_preferred: true,
        },
      ])
      expect((await request("q=RK3576")).components).toHaveLength(1)
      expect((await request("q=RK3576")).components[0].lcsc).toBe(42388007)
      expect((await request("q=RK3576&package=LQFP-64")).components).toEqual([])
      expect((await request("q=missing-part")).components).toEqual([])
      await env.DB.prepare(
        "UPDATE search_index SET stock=0 WHERE lcsc=42388007",
      ).run()
      expect((await request("q=RK3576")).components).toEqual([])
      for (const stock of [0, null]) {
        await env.DB.prepare(
          "UPDATE search_index SET stock=? WHERE lcsc=42388007",
        )
          .bind(stock)
          .run()
        const prefixed = await request("q=C42388007")
        const numeric = await request("q=42388007")
        expect(numeric).toEqual(prefixed)
        expect(prefixed.components).toMatchObject([
          { lcsc: 42388007, mfr: "RK3576", stock },
        ])
      }
      expect((await request("q=C99999999")).components).toEqual([])
    },
  )
})
