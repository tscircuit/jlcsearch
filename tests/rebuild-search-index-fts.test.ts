import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
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
  const eventPath = join(directory, "events.jsonl")
  writeFileSync(logPath, "")
  writeFileSync(eventPath, "")
  writeFileSync(
    join(directory, "bunx"),
    '#!/bin/sh\nexec "$TEST_BUN" "$TEST_WRANGLER" "$@"\n',
    { mode: 0o755 },
  )
  writeFileSync(
    join(directory, "sleep"),
    '#!/bin/sh\nprintf \'{"pause":"%s"}\\n\' "$1" >> "$TEST_EVENT_LOG"\n',
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
        FTS_PAUSE_SECONDS: "0",
        FTS_PERSIST_TO: "",
        RETRY_MAX_ATTEMPTS: "2",
        RETRY_BASE_DELAY_SECONDS: "0",
        CLOUDFLARE_API_TOKEN: "",
        CLOUDFLARE_ACCOUNT_ID: "",
        TEST_BUN: process.execPath,
        TEST_WRANGLER: fixtureScript,
        TEST_DB: dbPath,
        TEST_SQL_LOG: logPath,
        TEST_EVENT_LOG: eventPath,
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
    events: () =>
      readFileSync(eventPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(
          (line) =>
            JSON.parse(line) as {
              sql?: string
              changes?: number
              isImport?: boolean
              pause?: string
            },
        ),
    resetLogs: () => {
      writeFileSync(logPath, "")
      writeFileSync(eventPath, "")
    },
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
    expect(f.log()).not.toContain("DROP TABLE")
    expect(
      f
        .events()
        .filter((event) => event.isImport)
        .map((event) => event.changes),
    ).toEqual([1, 0, 1, 0, 0])
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

test("a failed batch leaves FTS disabled and resumes without rewriting completed entries", () => {
  const f = fixture()
  try {
    expect(f.run("failed_batch").exitCode).not.toBe(0)
    expect(f.readiness()).toEqual({ value: "0" })
    expect(f.source()).toEqual(f.before)
    expect(
      f.db
        .query("SELECT search_text FROM search_index_fts WHERE rowid=42388007")
        .get(),
    ).toEqual({ search_text: "rockchip rk3576" })
    f.resetLogs()
    expect(f.run().exitCode).toBe(0)
    expect(f.readiness()).toEqual({ value: "1" })
    expect(
      f
        .events()
        .filter((event) => event.isImport)
        .map((event) => event.changes),
    ).toEqual([0, 1, 0, 0])
    expect(f.log()).not.toContain("DROP TABLE")
  } finally {
    f.close()
  }
})

test("adopts an existing partial stable index without checkpoint metadata", () => {
  const f = fixture()
  try {
    f.db.exec(`INSERT INTO search_index_fts(rowid,search_text)
      VALUES(42388007,'rockchip rk3576'),(0,'invalid zero'),(-4,'invalid negative');
      UPDATE search_index_fts_meta SET value='0' WHERE key='ready_lcsc';`)
    const result = f.run()
    expect({
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
    }).toEqual({ exitCode: 0, stderr: "" })
    expect(
      f
        .events()
        .filter((event) => event.isImport)
        .map((event) => event.changes),
    ).toEqual([0, 1, 0, 0])
    expect(
      f.db
        .query("SELECT rowid,search_text FROM search_index_fts ORDER BY rowid")
        .all(),
    ).toEqual([
      { rowid: 1001, search_text: "tvs diode" },
      { rowid: 42388007, search_text: "rockchip rk3576" },
    ])
    expect(f.readiness()).toEqual({ value: "1" })
    expect(f.source()).toEqual(f.before)
    expect(f.log()).not.toContain("DROP TABLE")
  } finally {
    f.close()
  }
})

test("rerunning a complete index validates it without rewriting any indexed parts", () => {
  const f = fixture()
  try {
    expect(f.run().exitCode).toBe(0)
    f.resetLogs()
    expect(f.run().exitCode).toBe(0)
    const imports = f.events().filter((event) => event.isImport)
    expect(imports.length).toBeGreaterThan(0)
    expect(imports.every((event) => event.changes === 0)).toBe(true)
    expect(f.log()).toContain("AS expected_count")
    expect(f.log()).not.toContain("DROP TABLE")
    expect(f.readiness()).toEqual({ value: "1" })
  } finally {
    f.close()
  }
})

test.each([
  "DELETE FROM search_index WHERE lcsc=1001",
  "UPDATE search_index SET search_text='' WHERE lcsc=1001",
])("reconciles catalog changes between runs: %s", (change) => {
  const f = fixture()
  try {
    expect(f.run().exitCode).toBe(0)
    f.db.exec(`${change};
      UPDATE search_index SET search_text='updated rockchip processor' WHERE lcsc=42388007;
      INSERT INTO search_index(rowid,lcsc,search_text) VALUES(2,5000,'new connector');`)
    const source = f.source()
    f.resetLogs()
    const result = f.run()
    expect({
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
    }).toEqual({ exitCode: 0, stderr: "" })
    expect(
      f.db
        .query("SELECT rowid,search_text FROM search_index_fts ORDER BY rowid")
        .all(),
    ).toEqual([
      { rowid: 5000, search_text: "new connector" },
      { rowid: 42388007, search_text: "updated rockchip processor" },
    ])
    expect(f.source()).toEqual(source)
    expect(f.readiness()).toEqual({ value: "1" })
    expect(f.log()).not.toContain("DROP TABLE")
  } finally {
    f.close()
  }
})

test("pauses after successful setup, import, cleanup and validation calls", () => {
  const f = fixture()
  try {
    expect(f.run("", { FTS_PAUSE_SECONDS: "2" }).exitCode).toBe(0)
    const events = f.events()
    expect(events.length).toBeGreaterThan(10)
    for (let index = 0; index < events.length; index += 2) {
      expect(events[index].sql).toBeString()
      expect(events[index + 1]).toEqual({ pause: "2" })
    }
  } finally {
    f.close()
  }
})

test.each([
  "CREATE TABLE search_index_fts(search_text TEXT)",
  "CREATE VIRTUAL TABLE search_index_fts USING fts5(search_text, tokenize='unicode61')",
])(
  "refuses an incompatible existing index without replacing it: %s",
  (schema) => {
    const f = fixture()
    try {
      f.db.exec(
        `DROP TABLE search_index_fts; ${schema}; INSERT INTO search_index_fts(search_text) VALUES('preserve this');`,
      )
      expect(f.run().exitCode).not.toBe(0)
      expect(
        f.db.query("SELECT search_text FROM search_index_fts").all(),
      ).toEqual([{ search_text: "preserve this" }])
      expect(f.log()).not.toContain("DROP TABLE")
      expect(f.events().some((event) => event.isImport)).toBe(false)
    } finally {
      f.close()
    }
  },
)

test("creates a missing index and metadata table without changing the source", () => {
  const f = fixture()
  try {
    f.db.exec("DROP TABLE search_index_fts; DROP TABLE search_index_fts_meta;")
    const result = f.run()
    expect({
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
    }).toEqual({ exitCode: 0, stderr: "" })
    expect(f.readiness()).toEqual({ value: "1" })
    expect(f.source()).toEqual(f.before)
    expect(f.log()).not.toContain("DROP TABLE")
  } finally {
    f.close()
  }
})

test("refuses to reconcile without an indexed source LCSC lookup", () => {
  const f = fixture()
  try {
    f.db.exec("DROP INDEX idx_search_index_lcsc")
    expect(f.run().exitCode).not.toBe(0)
    expect(f.events().some((event) => event.isImport)).toBe(false)
    expect(
      f.db.query("SELECT search_text FROM search_index_fts").all(),
    ).toEqual([{ search_text: "legacy text" }])
    expect(f.source()).toEqual(f.before)
    expect(f.log()).not.toContain("DROP TABLE")
  } finally {
    f.close()
  }
})

test("real Wrangler rebuilds through queries when the import API is unavailable", async () => {
  const f = fixture()
  const directory = mkdtempSync(join(tmpdir(), "jlcsearch-fts-api-test-"))
  const scripts = join(directory, "scripts")
  mkdirSync(scripts)
  for (const name of [
    "rebuild-search-index-fts-batched.sh",
    "retry-command.sh",
    "setup-fts5.sql",
  ]) {
    copyFileSync(join(dirname(rebuildScript), name), join(scripts, name))
  }
  symlinkSync(
    fileURLToPath(new URL("../cf-proxy/node_modules", import.meta.url)),
    join(directory, "node_modules"),
    "dir",
  )
  // Use a disposable config, fake credentials and a loopback API. This never
  // contacts Cloudflare or reads the production Wrangler configuration.
  writeFileSync(
    join(directory, "wrangler.toml"),
    `name = "fts-api-test"
compatibility_date = "2024-10-22"
[[d1_databases]]
binding = "DB"
database_name = "local-fixture"
database_id = "00000000-0000-0000-0000-000000000001"
`,
  )
  const requests: string[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname
      requests.push(path)
      if (path.endsWith("/query") && request.method === "POST") {
        const { sql } = (await request.json()) as { sql: string }
        const results = /^\s*(?:--[^\n]*\n\s*)*CREATE\b/i.test(sql)
          ? (f.db.exec(sql), [])
          : f.db.query(sql).all()
        return Response.json({
          success: true,
          errors: [],
          messages: [],
          result: [{ success: true, results, meta: {} }],
        })
      }
      return Response.json(
        {
          success: false,
          errors: [{ code: 7009, message: "Upstream service unavailable" }],
          messages: [],
          result: null,
        },
        { status: 503 },
      )
    },
  })
  const child = Bun.spawn(
    ["bash", join(scripts, "rebuild-search-index-fts-batched.sh"), "--remote"],
    {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        CI: "true",
        DB_NAME: "local-fixture",
        FTS_BATCH_ROWS: "2",
        FTS_PAUSE_SECONDS: "0",
        RETRY_MAX_ATTEMPTS: "1",
        RETRY_BASE_DELAY_SECONDS: "0",
        CLOUDFLARE_API_BASE_URL: `${server.url}client/v4`,
        CLOUDFLARE_ACCOUNT_ID: "00000000000000000000000000000000",
        CLOUDFLARE_API_TOKEN: "local-test-token",
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_LOG_PATH: join(directory, "wrangler.log"),
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect({ exitCode, error: exitCode ? stderr : "" }).toEqual({
      exitCode: 0,
      error: "",
    })
    expect(stdout).toContain("2 validated entries")
    expect(requests.length).toBeGreaterThan(5)
    expect(requests.every((path) => path.endsWith("/query"))).toBe(true)
    expect(f.readiness()).toEqual({ value: "1" })
    expect(f.source()).toEqual(f.before)
  } finally {
    child.kill()
    await child.exited
    server.stop(true)
    f.close()
    rmSync(directory, { recursive: true, force: true })
  }
}, 60_000)

test.each([
  "missing",
  "wrong_text",
  "extra",
  "extra_negative",
  "extra_zero",
  "catalog_changed",
  "bad_json",
])("refuses to enable FTS after %s", (fault) => {
  const f = fixture()
  try {
    expect(f.run(fault).exitCode).not.toBe(0)
    expect(f.readiness()).toEqual({ value: "0" })
    expect(f.log()).not.toContain("RETURNING CAST(value AS INTEGER)")
  } finally {
    f.close()
  }
})

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
  { env: { FTS_PAUSE_SECONDS: "-1" }, args: ["--local"] },
  { env: { FTS_PAUSE_SECONDS: "61" }, args: ["--local"] },
  { env: { FTS_PAUSE_SECONDS: "0.5" }, args: ["--local"] },
  { env: { FTS_PAUSE_SECONDS: "1; SELECT 1" }, args: ["--local"] },
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
