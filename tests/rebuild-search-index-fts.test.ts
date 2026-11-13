import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { searchIndex } from "../cf-proxy/src/search"

const rebuildScript = fileURLToPath(
  new URL(
    "../cf-proxy/scripts/rebuild-search-index-fts-batched.sh",
    import.meta.url,
  ),
)
const fixtureScript = fileURLToPath(
  new URL("./fixtures/fts-wrangler.ts", import.meta.url),
)

const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), "jlcsearch-fts-test-"))
  const dbPath = join(directory, "test.sqlite")
  const logPath = join(directory, "sql.log")
  writeFileSync(logPath, "")
  writeFileSync(
    join(directory, "bunx"),
    '#!/bin/sh\nexec "$TEST_BUN" "$TEST_WRANGLER" "$@"\n',
    { mode: 0o755 },
  )
  const db = new Database(dbPath)
  db.exec(`CREATE TABLE search_index (
    lcsc INTEGER, mfr TEXT, package TEXT, description TEXT, stock INTEGER,
    price TEXT, price1 REAL, basic INTEGER, preferred INTEGER, category TEXT,
    subcategory TEXT, search_text TEXT);
    CREATE INDEX idx_search_index_lcsc ON search_index(lcsc);
    INSERT INTO search_index(rowid,lcsc,mfr,stock,price,search_text) VALUES
      (1,42388007,'RK3576',487,'1.50','rockchip rk3576'),
      (4,1001,'TVS',100,'0.10','tvs diode'),
      (7,1002,'No text',10,'0.20',NULL),
      (8,1003,'Empty text',20,'0.30','');
    CREATE TABLE component_catalog(lcsc INTEGER, stock INTEGER, price TEXT);
    INSERT INTO component_catalog SELECT lcsc, stock, price FROM search_index;
    CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='trigram');
    INSERT INTO search_index_fts(rowid,search_text) VALUES(2,'legacy text');
    CREATE TABLE search_index_fts_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    INSERT INTO search_index_fts_meta VALUES('ready_lcsc','1');`)
  const source = () => ({
    search: db.query("SELECT rowid,* FROM search_index ORDER BY rowid").all(),
    catalog: db.query("SELECT * FROM component_catalog ORDER BY lcsc").all(),
  })
  const before = source()
  const run = (
    fault = "",
    env: Record<string, string | undefined> = {},
    args: readonly string[] = ["--local"],
  ) =>
    Bun.spawnSync(["bash", rebuildScript, ...args], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        DB_NAME: "local-fixture",
        FTS_BATCH_ROWS: "2",
        FTS_PERSIST_TO: "",
        RETRY_MAX_ATTEMPTS: "2",
        RETRY_BASE_DELAY_SECONDS: "0",
        CLOUDFLARE_API_TOKEN: "",
        CLOUDFLARE_ACCOUNT_ID: "",
        TEST_BUN: process.execPath,
        TEST_WRANGLER: fixtureScript,
        TEST_DB: dbPath,
        TEST_SQL_LOG: logPath,
        TEST_FAULT: fault,
        ...env,
      },
      stdout: "pipe",
      stderr: "pipe",
    })
  return {
    db,
    run,
    before,
    source,
    log: () => readFileSync(logPath, "utf8"),
    readiness: () =>
      db
        .query("SELECT value FROM search_index_fts_meta WHERE key='ready_lcsc'")
        .get(),
    close: () => {
      db.close()
      rmSync(directory, { recursive: true, force: true })
    },
  }
}

test("rebuild retries committed batches, validates stable IDs, and preserves catalog/stock", async () => {
  const f = fixture()
  try {
    const result = f.run("lost_reply", { MAX_ROWID: "1" })
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString()).toContain("2 validated entries")
    expect(result.stderr.toString()).toContain("lost reply after commit")
    expect(f.readiness()).toEqual({ value: "1" })
    expect(f.source()).toEqual(f.before)
    expect(
      f.db
        .query("SELECT rowid, search_text FROM search_index_fts ORDER BY rowid")
        .all(),
    ).toEqual([
      { rowid: 1001, search_text: "tvs diode" },
      { rowid: 42388007, search_text: "rockchip rk3576" },
    ])
    expect(f.log()).not.toContain("VALUES('optimize')")
    const db = new Kysely({ dialect: new BunSqliteDialect({ database: f.db }) })
    const parts = await searchIndex(
      db as unknown as Parameters<typeof searchIndex>[0],
      { q: "rk3576" },
    )
    expect(parts.map((part) => part.lcsc)).toEqual([42388007])
  } finally {
    f.close()
  }
})

test("a failed batch leaves FTS disabled and a clean rerun recovers", () => {
  const f = fixture()
  try {
    expect(f.run("failed_batch").exitCode).not.toBe(0)
    expect(f.readiness()).toEqual({ value: "0" })
    expect(f.source()).toEqual(f.before)
    expect(f.run().exitCode).toBe(0)
    expect(f.readiness()).toEqual({ value: "1" })
  } finally {
    f.close()
  }
})

test.each(["missing", "wrong_text", "extra", "catalog_changed", "bad_json"])(
  "refuses to enable FTS after %s",
  (fault) => {
    const f = fixture()
    try {
      expect(f.run(fault).exitCode).not.toBe(0)
      expect(f.readiness()).toEqual({ value: "0" })
      expect(f.log()).not.toContain("RETURNING CAST(value AS INTEGER)")
    } finally {
      f.close()
    }
  },
)

test("duplicate source IDs fail validation even when their search text matches", () => {
  const f = fixture()
  try {
    f.db.exec(
      "INSERT INTO search_index(rowid,lcsc,search_text) VALUES(2,1001,'tvs diode')",
    )
    expect(f.run().exitCode).not.toBe(0)
    expect(f.readiness()).toEqual({ value: "0" })
  } finally {
    f.close()
  }
})

test("an empty catalog is rejected before changing the old index", () => {
  const f = fixture()
  try {
    f.db.exec("DELETE FROM search_index")
    expect(f.run().exitCode).not.toBe(0)
    expect(f.readiness()).toEqual({ value: "1" })
    expect(
      f.db.query("SELECT search_text FROM search_index_fts").all(),
    ).toEqual([{ search_text: "legacy text" }])
    expect(f.log()).not.toContain("DROP TABLE")
  } finally {
    f.close()
  }
})

test.each([
  "UPDATE search_index SET search_text=NULL",
  "UPDATE search_index SET lcsc=NULL WHERE rowid=1",
  "UPDATE search_index SET lcsc=0 WHERE rowid=1",
])("an unusable catalog cannot enable the index: %s", (sql) => {
  const f = fixture()
  try {
    f.db.exec(sql)
    expect(f.run().exitCode).not.toBe(0)
    expect(f.readiness()).toEqual({ value: "0" })
  } finally {
    f.close()
  }
})

test.each([
  { env: { DB_NAME: "" }, args: ["--local"] },
  { env: {}, args: [] },
  { env: { FTS_BATCH_ROWS: "0" }, args: ["--local"] },
  { env: { FTS_BATCH_ROWS: "5001" }, args: ["--local"] },
  { env: { FTS_BATCH_ROWS: "2; SELECT 1" }, args: ["--local"] },
])("rejects unsafe arguments before any database call: %j", ({ env, args }) => {
  const f = fixture()
  try {
    expect(f.run("", env, args).exitCode).toBe(2)
    expect(f.log()).toBe("")
    expect(f.readiness()).toEqual({ value: "1" })
  } finally {
    f.close()
  }
})
