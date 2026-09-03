import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { getD1Client } from "../cf-proxy/src/db/get-d1-client"
import { queryComponentCatalog } from "../cf-proxy/src/components"
import { searchIndex } from "../cf-proxy/src/search"

for (const ftsState of ["ready", "not ready", "missing"] as const) {
  describe(`component search with FTS ${ftsState}`, () => {
    test("finds unavailable exact parts without including unavailable broad matches", async () => {
      const database = new Database(":memory:")
      database.exec(`
        CREATE TABLE search_index (
          lcsc INTEGER, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
          price TEXT, price1 REAL, basic INTEGER, preferred INTEGER,
          category TEXT, subcategory TEXT, search_text TEXT
        );
        INSERT INTO search_index VALUES
          (5307358, 'RV1103G1', 'QFN-88(9x9)', 'Rockchip MCU', 0,
           '[]', 6.85, 0, 0, 'ICs', 'MCUs', 'rv1103g1 rockchip mcu'),
          (5307359, 'RV1103G1-VARIANT', 'QFN-88(9x9)', 'Rockchip MCU', 10,
           '[]', 7, 0, 0, 'ICs', 'MCUs', 'rv1103g1-variant rockchip mcu'),
          (5307360, 'RV1103G1-UNAVAILABLE', 'QFN-88(9x9)', 'Rockchip MCU', 0,
           '[]', 7, 0, 0, 'ICs', 'MCUs', 'rv1103g1-unavailable rockchip mcu');
      `)
      if (ftsState !== "missing") {
        database.exec(`
          CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
          INSERT INTO search_index_fts(rowid, search_text)
            SELECT rowid, search_text FROM search_index;
          CREATE TABLE search_index_fts_meta (key TEXT PRIMARY KEY, value TEXT);
          INSERT INTO search_index_fts_meta VALUES ('ready', '${ftsState === "ready" ? "1" : "0"}');
        `)
      }
      // Run the production D1 query adapter against real SQLite, including FTS.
      const db = getD1Client({
        prepare: (query: string) => ({
          bind: (...parameters: Array<string | number | null>) => ({
            all: async () => ({
              results: database.query(query).all(...parameters),
              meta: { changes: 0 },
            }),
          }),
        }),
      } as unknown as Parameters<typeof getD1Client>[0])
      try {
        for (const q of [
          "RV1103G1",
          " rv1103g1 ",
          "C5307358",
          "c5307358",
          "5307358",
        ]) {
          const rows = await searchIndex(db, { q, limit: "1" })
          expect(rows.map(({ lcsc, stock }) => ({ lcsc, stock }))).toEqual([
            { lcsc: 5307358, stock: 0 },
          ])
        }

        const components = await queryComponentCatalog(db, {
          search: "RV1103G1",
        })
        expect(components.map((row) => row.lcsc)).toEqual([5307358, 5307359])

        for (const q of [undefined, "RV1103", "Rockchip", "MCU"]) {
          expect((await searchIndex(db, { q })).map((row) => row.lcsc)).toEqual(
            [5307359],
          )
        }

        for (const q of ["RV1103G1", "C5307358"]) {
          expect(await searchIndex(db, { q, package: "BGA" })).toEqual([])
          expect(
            await searchIndex(db, { q, subcategory_name: "Resistors" }),
          ).toEqual([])
          expect(await searchIndex(db, { q, is_basic: "true" })).toEqual([])
          expect(await searchIndex(db, { q, is_preferred: "true" })).toEqual([])
        }
        expect(await searchIndex(db, { q: "RV1103G2" })).toEqual([])
        expect(await searchIndex(db, { q: "RV1103G1' OR 1=1 --" })).toEqual([])
      } finally {
        await db.destroy()
        database.close()
      }
    })
  })
}
