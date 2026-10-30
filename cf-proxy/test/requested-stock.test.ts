import { env } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import worker from "../src/index"

describe("exact BOM availability", () => {
  it("enrolls misses, returns unknown/zero honestly, and ignores stale response caches", async () => {
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
  })
})
