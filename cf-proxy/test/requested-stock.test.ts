import { describe, expect, it } from "vitest"
import worker from "../src/index"

const workerTest = "Bun" in globalThis ? it.skip : it

describe("exact BOM availability", () => {
  workerTest(
    "enrolls misses, returns unknown/zero honestly, and ignores stale response caches",
    async () => {
      const { env } = await import("cloudflare:test")
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS _jlcsearch_requested_parts (
      lcsc INTEGER PRIMARY KEY, requested_at INTEGER NOT NULL, attempted_at INTEGER DEFAULT 0,
      verified_at INTEGER, component_json TEXT, last_error TEXT)`).run()
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS search_index (
      lcsc INTEGER UNIQUE, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
      price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
      subcategory TEXT, search_text TEXT)`).run()
      await env.DB.prepare(
        "INSERT INTO search_index (lcsc,mfr,stock) VALUES (7519,'USBLC6-2SC6',NULL), (970725,'CH224K',0)",
      ).run()
      const request = async (q: string) => {
        const response = await worker.fetch(
          new Request(`https://example.com/api/search?q=${q}&limit=1`),
          { ...env, USE_D1: "true" },
          { waitUntil() {} } as any,
        )
        expect(response.status).toBe(200)
        expect(response.headers.get("cache-control")).toBe("no-store")
        return (await response.json()) as any
      }
      expect((await request("C7519")).components[0].stock).toBeNull()
      expect((await request("970725")).components[0].stock).toBe(0)
      expect((await request("C5981428")).components).toEqual([])
      expect(
        await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM _jlcsearch_requested_parts",
        ).first("n"),
      ).toBe(3)
      const component = {
        lcsc: 5981428,
        mfr: "new part",
        stock: 547,
        package: "",
        description: "",
        is_basic: false,
        is_preferred: false,
        price: 0.3,
      }
      await env.DB.prepare(
        "UPDATE _jlcsearch_requested_parts SET verified_at=unixepoch(),component_json=? WHERE lcsc=5981428",
      )
        .bind(JSON.stringify(component))
        .run()
      expect((await request("C5981428")).components[0]).toMatchObject(component)
      await env.DB.prepare(
        "UPDATE _jlcsearch_requested_parts SET verified_at=unixepoch()-86400 WHERE lcsc=5981428",
      ).run()
      expect((await request("C5981428")).components[0].stock).toBeNull()
      const list = async (suffix = "") => {
        const response = await worker.fetch(
          new Request(
            `https://example.com/components/list.json?search=C5981428${suffix}`,
          ),
          { ...env, USE_D1: "true" },
          { waitUntil() {} } as any,
        )
        expect(response.status).toBe(200)
        expect(response.headers.get("cache-control")).toBe("no-store")
        return (await response.json()) as any
      }
      // A part absent from the imported catalog is still available by exact ID.
      expect((await list()).components[0]).toMatchObject({
        lcsc: 5981428,
        stock: null,
      })
      expect((await list("&package=wrong")).components).toEqual([])
      await env.DB.prepare(
        "INSERT INTO search_index (lcsc,mfr,stock,package) VALUES (5981428,'new part',487,'BGA')",
      ).run()
      // An expired observation must not resurrect the catalog's older 487 units.
      expect((await list()).components[0].stock).toBeNull()
      expect(
        (await request("C5981428&package=BGA")).components[0].stock,
      ).toBeNull()
      await env.DB.prepare(
        "UPDATE _jlcsearch_requested_parts SET verified_at=unixepoch() WHERE lcsc=5981428",
      ).run()
      expect((await list()).components[0]).toMatchObject({
        stock: 547,
      })
      expect((await list("&package=BGA")).components[0].stock).toBe(547)
    },
  )
})
