import { expect, it } from "vitest"

// SELF exercises separate Worker request contexts, including response ownership.
const workerTest = "Bun" in globalThis ? it.skip : it

workerTest(
  "concurrent real Worker requests can independently consume shared results",
  async () => {
    const { env, SELF } = await import("cloudflare:test")
    await env.DB.prepare(`CREATE TABLE search_index (
    lcsc INTEGER UNIQUE, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
    price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
    subcategory TEXT, search_text TEXT)`).run()
    await env.DB.prepare(`INSERT INTO search_index(lcsc,mfr,stock,search_text)
    VALUES (1,'Test part',100,'test part')`).run()
    for (const suffix of ["", "?cachebust=1"]) {
      const responses = await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          SELF.fetch(`https://example.com/api/search${suffix}`, {
            headers: { origin: `https://client${i}.example` },
          }),
        ),
      )
      for (const [i, response] of responses.entries()) {
        expect(response.status).toBe(200)
        expect(response.headers.get("access-control-allow-origin")).toBe(
          `https://client${i}.example`,
        )
        expect(await response.json()).toMatchObject({
          components: [{ lcsc: 1, mfr: "Test part" }],
        })
      }
    }
  },
)
