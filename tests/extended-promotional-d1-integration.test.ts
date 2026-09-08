/// <reference path="../cf-proxy/node_modules/@cloudflare/workers-types/index.d.ts" />

import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import worker, { type Env } from "../cf-proxy/src/index"
import { buildDerivedSyncDatabase } from "../scripts/build-derived-sync-db"
import {
  getDerivedPreferredTargets,
  parseStockSyncSchema,
  STOCK_SYNC_SCHEMA_QUERY,
  writeStockSyncBatches,
} from "../scripts/generate-stock-sync-sql"

// The snapshot builder needs Bun SQLite, so this runs under Bun while using
// cf-proxy's installed Miniflare for REAL local Cloudflare D1, KV and R2 bindings.
// The application worker runs in this process; its SQL/results are not mocked.
const requireFromProxy = createRequire(
  new URL("../cf-proxy/package.json", import.meta.url),
)
const { Miniflare } = requireFromProxy("miniflare")

type Row = Record<string, string | number | boolean | null>

test("source snapshots refresh promotional API and category filters through real local D1 at constant stock", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "jlc-promotional-d1-"))
  const sourcePath = path.join(directory, "source.sqlite3")
  const snapshotPath = path.join(directory, "snapshot.sqlite3")
  const pending: Promise<unknown>[] = []
  const mf = new Miniflare({
    modules: true,
    script:
      "export default { fetch() { throw new Error('No fixture HTTP route') } }",
    compatibilityDate: "2024-10-22",
    d1Databases: ["DB"],
    kvNamespaces: ["CACHE_KV"],
    r2Buckets: ["EASYEDA_COMPONENT_CACHE"],
    bindings: { USE_D1: "true" },
    outboundService: () => {
      throw new Error("This integration test must not make remote requests")
    },
  })
  const source = new Database(sourcePath)
  try {
    source.exec(`
      CREATE TABLE jlc_components (
        lcsc INTEGER PRIMARY KEY, fetched_at INTEGER, present INTEGER,
        sync_seen INTEGER, category TEXT, subcategory TEXT, mfr TEXT,
        package TEXT, joints INTEGER, manufacturer TEXT, library_type TEXT,
        preferred INTEGER, last_on_stock INTEGER, description TEXT,
        datasheet TEXT, stock INTEGER, price TEXT, attributes TEXT
      );
      CREATE TABLE lcsc_components (
        lcsc INTEGER PRIMARY KEY, fetched_at INTEGER, manufacturer TEXT,
        attributes TEXT, image TEXT, url_slug TEXT
      );
      INSERT INTO jlc_components VALUES
        (101, unixepoch(), 1, 1, 'Resistors', 'Chip Resistors', 'TEST-101',
         '0603', 2, 'Synthetic', 'base', 0, unixepoch(), 'Synthetic resistor',
         '', 30, '1-:0.25', '{"Resistance":"1kΩ","Tolerance":"1%","Power(Watts)":"0.1W"}'),
        (102, unixepoch(), 1, 1, 'Resistors', 'Chip Resistors', 'TEST-102',
         '0603', 2, 'Synthetic', 'expand', 1, unixepoch(), 'Synthetic resistor',
         '', 20, '1-:0.25', '{"Resistance":"2kΩ","Tolerance":"1%","Power(Watts)":"0.1W"}');
    `)

    const buildSnapshot = () =>
      buildDerivedSyncDatabase({
        sourcePath,
        outputPath: snapshotPath,
        tableNames: ["resistor"],
        includeComponentCatalog: true,
        includeStockSnapshot: true,
        logger: () => {},
      })
    await buildSnapshot()

    const env = (await mf.getBindings()) as Env
    const d1 = env.DB
    const seed = new Database(snapshotPath, { readonly: true })
    try {
      for (const table of ["component_catalog", "resistor"]) {
        const schema = seed
          .query<{ sql: string }, [string]>(
            "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?",
          )
          .get(table)!
        await d1.prepare(schema.sql).run()
        const rows = seed
          .query(`SELECT * FROM ${table} ORDER BY lcsc`)
          .all() as Row[]
        expect(rows.map((row) => row.lcsc)).toEqual([101, 102])
        // Unknown catalog membership is intentionally outside the source snapshot.
        rows.push({
          ...rows[0],
          lcsc: 103,
          stock: 10,
          ...(table === "component_catalog"
            ? { preferred: null, basic: 0 }
            : { is_preferred: null, is_basic: 0 }),
        })
        for (const row of rows) {
          const names = Object.keys(row)
          await d1
            .prepare(
              `INSERT INTO ${table} (${names.map((name) => `"${name}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`,
            )
            .bind(...Object.values(row))
            .run()
        }
      }
    } finally {
      seed.close()
    }
    await d1.batch([
      d1.prepare(`CREATE TABLE search_index AS SELECT *, 0.25 AS price1,
        mfr || ' ' || description AS search_text FROM component_catalog`),
      d1.prepare("CREATE TABLE capacitor (lcsc INTEGER PRIMARY KEY)"),
      d1.prepare(
        "CREATE TABLE unrelated_table (lcsc INTEGER PRIMARY KEY, is_preferred INTEGER)",
      ),
      d1.prepare("INSERT INTO unrelated_table VALUES (101, 7)"),
    ])

    // Execute the exact production discovery query in Cloudflare's SQLite,
    // including its sqlite_schema JOIN pragma_table_info table-valued function.
    const discovery = await d1.prepare(STOCK_SYNC_SCHEMA_QUERY).all()
    expect(discovery.success).toBe(true)
    expect(discovery.meta.served_by).toBe("miniflare.db")
    const schema = parseStockSyncSchema([discovery])
    expect(getDerivedPreferredTargets(schema)).toEqual(["resistor"])

    const readRoute = async (
      pathname: string,
      params: Record<string, string> = {},
    ) => {
      const url = new URL(pathname, "https://local.test")
      url.search = new URLSearchParams({ ...params, cachebust: "1" }).toString()
      const response = await worker.fetch(new Request(url), env, {
        waitUntil: (promise: Promise<unknown>) => {
          pending.push(promise)
        },
        passThroughOnException() {},
      } as Parameters<typeof worker.fetch>[2])
      expect(response.status).toBe(200)
      expect(response.headers.get("x-data-source")).toBe("d1")
      const body = (await response.json()) as Record<string, Row[]>
      return Object.values(body)[0].sort(
        (a, b) => Number(a.lcsc) - Number(b.lcsc),
      )
    }
    const ids = (rows: Row[]) => rows.map((row) => row.lcsc)
    const routes = [
      "/api/search",
      "/components/list.json",
      "/resistors/list.json",
    ]
    const beforeStocks = new Map<string, Record<string, unknown>[]>()
    for (const table of ["component_catalog", "search_index", "resistor"]) {
      beforeStocks.set(
        table,
        (
          await d1
            .prepare(`SELECT lcsc, stock FROM ${table} ORDER BY lcsc`)
            .all()
        ).results,
      )
    }
    for (const route of routes) {
      expect(
        ids(await readRoute(route, { is_extended_promotional: "true" })),
      ).toEqual([102])
    }

    // Change only membership: one promotion starts, another ends.
    source.exec(
      "UPDATE jlc_components SET preferred = CASE lcsc WHEN 101 THEN 1 ELSE 0 END",
    )
    await buildSnapshot()
    const snapshot = new Database(snapshotPath, { readonly: true })
    try {
      expect(
        snapshot
          .query(
            "SELECT lcsc, stock, preferred FROM component_stock ORDER BY lcsc",
          )
          .all(),
      ).toEqual([
        { lcsc: 101, stock: 30, preferred: 1 },
        { lcsc: 102, stock: 20, preferred: 0 },
      ])
    } finally {
      snapshot.close()
    }
    const outputDirectory = path.join(directory, "batches")
    expect(
      await writeStockSyncBatches({
        sourcePath: snapshotPath,
        outputDirectory,
        batchSize: 1,
        targetSchema: schema,
      }),
    ).toEqual({ rowCount: 2, batchCount: 2 })
    for (const file of (await readdir(outputDirectory)).sort()) {
      const sql = await readFile(path.join(outputDirectory, file), "utf8")
      // Generated statements contain only validated integer values/known names;
      // splitting their separators is not used as a general SQL-file parser.
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
      const results = await d1.batch(
        statements.map((statement) => d1.prepare(statement)),
      )
      expect(results.every((result) => result.success)).toBe(true)
    }
    for (const [table, expected] of beforeStocks) {
      expect(
        (
          await d1
            .prepare(`SELECT lcsc, stock FROM ${table} ORDER BY lcsc`)
            .all()
        ).results,
      ).toEqual(expected)
    }
    expect(
      (await d1.prepare("SELECT is_preferred FROM unrelated_table").first())
        ?.is_preferred,
    ).toBe(7)

    for (const route of routes) {
      const falseIds = route === "/resistors/list.json" ? [102] : [102, 103]
      for (const value of ["true", "1"]) {
        const rows = await readRoute(route, { is_extended_promotional: value })
        expect(ids(rows)).toEqual([101])
        expect(rows[0]).toMatchObject({
          is_basic: true,
          is_preferred: true,
          is_extended_promotional: true,
        })
      }
      for (const value of ["false", "0"]) {
        const rows = await readRoute(route, { is_extended_promotional: value })
        expect(ids(rows)).toEqual(falseIds)
        for (const row of rows)
          expect(row).toMatchObject({
            is_preferred: false,
            is_extended_promotional: false,
          })
      }
      expect(
        ids(
          await readRoute(route, {
            is_extended_promotional: "false",
            is_preferred: "true",
          }),
        ),
      ).toEqual(falseIds)
      expect(
        ids(
          await readRoute(route, {
            is_extended_promotional: "true",
            is_preferred: "false",
          }),
        ),
      ).toEqual([101])
      for (const value of ["", "invalid"]) {
        expect(
          ids(
            await readRoute(route, {
              is_extended_promotional: value,
              is_preferred: "true",
            }),
          ),
        ).toEqual([101, 102, 103])
      }
      expect(ids(await readRoute(route, { is_preferred: "true" }))).toEqual([
        101,
      ])
      expect(ids(await readRoute(route, { is_preferred: "false" }))).toEqual(
        route === "/resistors/list.json" ? [102] : [101, 102, 103],
      )
    }
    expect((await readRoute("/resistors/list.json"))[2]).toMatchObject({
      lcsc: 103,
      is_preferred: null,
      is_extended_promotional: null,
    })

    // LCD/TFT consume catalog flags directly and preserve their existing
    // Boolean(null) response contract, unlike derived category nulls.
    await d1
      .prepare(
        "UPDATE component_catalog SET subcategory = 'LCD Drivers', mfr = 'SSD1963QL9' WHERE lcsc IN (102, 103)",
      )
      .run()
    for (const route of [
      "/lcd_drivers/list.json",
      "/tft_display_drivers/list.json",
    ]) {
      const rows = await readRoute(route, {
        is_extended_promotional: "false",
        is_preferred: "true",
      })
      expect(ids(rows)).toEqual([102, 103])
      for (const row of rows)
        expect(row).toMatchObject({
          is_preferred: false,
          is_extended_promotional: false,
        })
      expect(
        ids(await readRoute(route, { is_extended_promotional: "true" })),
      ).toEqual([])
    }
  } finally {
    source.close()
    await Promise.allSettled(pending)
    await mf.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 30_000)
