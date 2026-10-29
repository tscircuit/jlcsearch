import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"

const scripts = new URL("../cf-proxy/scripts/", import.meta.url)

for (const writer of ["sql", "batched", "sync"] as const) {
  test(`${writer} catalog replacement disables the previous FTS index`, async () => {
    const db = new Database(":memory:")
    try {
      db.exec(`
        CREATE TABLE component_catalog (
          lcsc INTEGER, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
          price TEXT, basic INTEGER, preferred INTEGER, category TEXT,
          subcategory TEXT, extra TEXT
        );
        INSERT INTO component_catalog VALUES
          (431535, 'PJ-320D', 'SMD', 'jack', 100, '[]', 0, 0, 'Connectors', 'Audio', '{}');
      `)
      const rebuildSql = await Bun.file(
        new URL("rebuild-search-index-from-component-catalog.sql", scripts),
      ).text()
      db.exec(rebuildSql)
      db.exec(await Bun.file(new URL("setup-fts5.sql", scripts)).text())
      db.exec(`
        INSERT INTO search_index_fts(rowid, search_text)
          SELECT lcsc, search_text FROM search_index;
        UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready';
      `)

      if (writer === "sql") {
        db.exec(rebuildSql)
      } else if (writer === "batched") {
        db.exec("CREATE TABLE search_index_next AS SELECT * FROM search_index")
        const script = await Bun.file(
          new URL("rebuild-search-index-batched.sh", scripts),
        ).text()
        const swap = script
          .slice(script.indexOf('echo "Swapping search index tables..."'))
          .match(/--command \\\n\s*"([\s\S]*?)"/)
        expect(swap).not.toBeNull()
        db.exec(swap![1])
      } else {
        const script = await Bun.file(new URL("sync-db.sh", scripts)).text()
        const exportedSchema = script.match(
          /<<'SEARCH_INDEX_SCHEMA_EXPORT'\n([\s\S]*?)\nSEARCH_INDEX_SCHEMA_EXPORT/,
        )
        expect(exportedSchema).not.toBeNull()
        db.exec(exportedSchema![1])
      }

      expect(
        db
          .query("SELECT value FROM search_index_fts_meta WHERE key = 'ready'")
          .get(),
      ).toEqual({ value: "0" })
      // The old index still contains rows: the readiness flag must prevent its use.
      expect(
        db.query("SELECT COUNT(*) AS count FROM search_index_fts").get(),
      ).toEqual({ count: 1 })
    } finally {
      db.close()
    }
  })
}

for (const writer of ["rebuild-search-index-fts-batched.sh", "sync-db.sh"]) {
  test(`${writer} FTS batches use LCSC as rowid`, async () => {
    const db = new Database(":memory:")
    try {
      db.exec(`
        CREATE TABLE search_index (lcsc INTEGER, search_text TEXT);
        INSERT INTO search_index VALUES (431535, 'pj-320d'), (21659, 'xc6206p182mr');
      `)
      db.exec(await Bun.file(new URL("setup-fts5.sql", scripts)).text())
      const script = await Bun.file(new URL(writer, scripts)).text()
      const insert = script.match(
        writer === "sync-db.sh"
          ? /DELETE FROM search_index_fts[\s\S]*?INSERT INTO search_index_fts[\s\S]*?;/
          : /INSERT INTO search_index_fts\([\s\S]*?;/,
      )
      expect(insert).not.toBeNull()
      const batchSql = insert![0]
        .replaceAll("${start}", "1")
        .replaceAll("${end}", "2")
      db.exec(batchSql)
      // A retry must replace the same LCSC IDs, not delete catalog row numbers.
      if (writer === "sync-db.sh") db.exec(batchSql)
      expect(
        db
          .query(
            "SELECT rowid, search_text FROM search_index_fts ORDER BY rowid",
          )
          .all(),
      ).toEqual([
        { rowid: 21659, search_text: "xc6206p182mr" },
        { rowid: 431535, search_text: "pj-320d" },
      ])
      expect(
        db
          .query("SELECT key, value FROM search_index_fts_meta ORDER BY key")
          .all(),
      ).toEqual([
        { key: "ready", value: "0" },
        { key: "rowid_source", value: "lcsc" },
      ])
    } finally {
      db.close()
    }
  })
}
