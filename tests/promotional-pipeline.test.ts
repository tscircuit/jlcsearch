import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createStockSyncBatchSql } from "../scripts/generate-stock-sync-sql"

const read = (file: string) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replace(
    /\r\n/g,
    "\n",
  )
const sync = read("cf-proxy/scripts/sync-db.sh")
const block = (marker: string) => {
  const start = sync.indexOf(`<<'${marker}'\n`) + marker.length + 5
  return sync.slice(start, sync.indexOf(`\n${marker}`, start))
}
const oldCatalog = `CREATE TABLE component_catalog (lcsc INTEGER UNIQUE, category TEXT, subcategory TEXT, mfr TEXT, package TEXT, basic INTEGER, preferred INTEGER, description TEXT, stock INTEGER, price TEXT, extra TEXT);
INSERT INTO component_catalog VALUES (1,'ICs','LCD Drivers','HT1621','SMD',0,1,'LCD driver',100,'1-9:0.50','{}'), (2,'ICs','LCD Drivers','HT1622','SMD',1,1,'LCD driver',90,'1-9:0.60','{}'), (3,'ICs','LCD Drivers','HT1623','SMD',0,0,'LCD driver',80,'1-9:0.70','{}');`
const migration = read("cf-proxy/migrations/0010_is_extended_promotional.sql")
const values = (db: Database, table: string) =>
  db
    .query(
      `SELECT lcsc, is_extended_promotional AS flag FROM ${table} ORDER BY lcsc`,
    )
    .all()

describe("promotional lifecycle SQL", () => {
  test("legacy null classification requires a fresh source snapshot", () => {
    const db = new Database(":memory:")
    db.exec(
      oldCatalog +
        "CREATE TABLE search_index AS SELECT * FROM component_catalog;",
    )
    // This is the pre-feature builder's actual expression. It loses provenance.
    const oldBasic = db
      .query("SELECT CASE WHEN NULL = 'base' THEN 1 ELSE 0 END AS basic")
      .get()
    expect(oldBasic).toEqual({ basic: 0 })
    db.exec(migration)
    expect(values(db, "component_catalog")[0]).toEqual({ lcsc: 1, flag: 1 })
    // The fresh builder's strict source predicate emits 0 for NULL library_type.
    db.exec(
      createStockSyncBatchSql([
        { lcsc: 1, stock: 100, is_extended_promotional: 0 },
      ]),
    )
    expect(values(db, "component_catalog")[0]).toEqual({ lcsc: 1, flag: 0 })
    db.close()
  })
  test.each([false, true])(
    "migration backfills with legacy components present=%s",
    (legacy) => {
      const db = new Database(":memory:")
      db.exec(
        oldCatalog +
          "CREATE TABLE search_index AS SELECT * FROM component_catalog;",
      )
      if (legacy) db.exec("CREATE TABLE components(lcsc INTEGER)")
      db.exec(migration)
      for (const table of ["component_catalog", "search_index"])
        expect(values(db, table)).toEqual([
          { lcsc: 1, flag: 1 },
          { lcsc: 2, flag: 0 },
          { lcsc: 3, flag: 0 },
        ])
      expect(db.query("PRAGMA integrity_check").get()).toEqual({
        integrity_check: "ok",
      })
      db.close()
    },
  )

  test("full sync legacy materialization, export and direct index rebuild preserve the flag", () => {
    const db = new Database(":memory:")
    db.exec(
      oldCatalog +
        "ALTER TABLE component_catalog RENAME TO legacy; CREATE VIEW v_components AS SELECT * FROM legacy;",
    )
    db.exec(block("COMPONENT_CATALOG_SCHEMA"))
    db.exec(block("SEARCH_INDEX_SCHEMA"))
    expect(values(db, "search_index")).toEqual(values(db, "component_catalog"))
    db.exec(
      read("cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql"),
    )
    expect(values(db, "search_index")).toEqual([
      { lcsc: 1, flag: 1 },
      { lcsc: 2, flag: 0 },
      { lcsc: 3, flag: 0 },
    ])
    const exported = new Database(":memory:")
    exported.exec(block("COMPONENT_CATALOG_SCHEMA_EXPORT"))
    exported.exec(block("SEARCH_INDEX_SCHEMA_EXPORT"))
    for (const table of ["component_catalog", "search_index"])
      expect(
        exported
          .query(
            `SELECT name FROM pragma_table_info('${table}') WHERE name='is_extended_promotional'`,
          )
          .get(),
      ).not.toBeNull()
    exported.close()
    db.close()
  })

  test("batched rebuild SQL carries status through swap and retains rollback rows", () => {
    const db = new Database(":memory:")
    db.exec(
      oldCatalog +
        "CREATE TABLE search_index AS SELECT * FROM component_catalog;",
    )
    db.exec(migration)
    const batched = read("cf-proxy/scripts/rebuild-search-index-batched.sh")
    const statements = [
      ...batched.matchAll(/--command \\\n\s*"([\s\S]*?)"/g),
    ].map((match) => match[1])
    db.exec(
      statements.find((sql) => sql.includes("CREATE TABLE search_index_next"))!,
    )
    const insert = batched
      .slice(
        batched.indexOf("INSERT INTO search_index_next"),
        batched.indexOf(
          "\nEOF",
          batched.indexOf("INSERT INTO search_index_next"),
        ),
      )
      .replaceAll("__START__", "1")
      .replaceAll("__END__", "2")
    db.exec(insert)
    db.exec(insert.replace("BETWEEN 1 AND 2", "BETWEEN 3 AND 3"))
    for (const statement of statements.filter(
      (sql) => sql.includes("CREATE INDEX") || sql.includes("ALTER TABLE"),
    ))
      db.exec(statement)
    expect(values(db, "search_index")).toEqual(values(db, "search_index_old"))
    expect(values(db, "search_index")).toHaveLength(3)
    db.close()
  })

  test("daily status changes apply with unchanged stock and retries are idempotent", () => {
    const db = new Database(":memory:")
    db.exec(
      oldCatalog +
        "CREATE TABLE search_index AS SELECT * FROM component_catalog;",
    )
    db.exec(migration)
    const sql = createStockSyncBatchSql([
      { lcsc: 1, stock: 100, is_extended_promotional: 0 },
      { lcsc: 3, stock: 80, is_extended_promotional: 1 },
    ])
    db.exec(sql)
    for (const table of ["component_catalog", "search_index"])
      expect(values(db, table)).toEqual([
        { lcsc: 1, flag: 0 },
        { lcsc: 2, flag: 0 },
        { lcsc: 3, flag: 1 },
      ])
    const changes = db.query("SELECT total_changes() AS n").get()
    db.exec(sql)
    expect(db.query("SELECT total_changes() AS n").get()).toEqual(changes)
    db.exec(createStockSyncBatchSql([{ lcsc: 3, stock: 70 }]))
    expect(values(db, "search_index")[2]).toEqual({ lcsc: 3, flag: 1 })
    db.close()
  })
})
