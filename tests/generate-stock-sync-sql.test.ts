import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createStockSyncBatchSql,
  readStockSyncTargets,
  STOCK_SYNC_TARGETS_QUERY,
  type StockSyncTarget,
  writeStockSyncBatches,
} from "../scripts/generate-stock-sync-sql"

const tempDirectories: string[] = []

const createTempDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "jlcsearch-stock-sync-"))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe("stock sync SQL generation", () => {
  test("updates only changed stock in existing catalog and search rows", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const outputDirectory = path.join(directory, "batches")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (lcsc INTEGER, stock INTEGER);
      INSERT INTO component_stock(lcsc, stock) VALUES
        (1, 10),
        (2, NULL),
        (3, 0),
        (4, 40);
    `)
    source.close()

    const result = await writeStockSyncBatches({
      sourcePath,
      outputDirectory,
      batchSize: 2,
    })
    expect(result).toEqual({ rowCount: 4, batchCount: 2 })

    const target = new Database(":memory:")
    target.exec(`
      CREATE TABLE component_catalog (lcsc INTEGER UNIQUE, stock INTEGER);
      CREATE TABLE search_index (lcsc INTEGER UNIQUE, stock INTEGER);
      INSERT INTO component_catalog(lcsc, stock) VALUES
        (1, 1), (2, NULL), (3, 3), (99, 99);
      INSERT INTO search_index(lcsc, stock) VALUES
        (1, 1), (2, NULL), (3, 3), (99, 99);
      CREATE TABLE stock_updates_audit (lcsc INTEGER);
      CREATE TRIGGER catalog_stock_updated AFTER UPDATE ON component_catalog
        BEGIN INSERT INTO stock_updates_audit VALUES (new.lcsc); END;
      CREATE TRIGGER search_stock_updated AFTER UPDATE ON search_index
        BEGIN INSERT INTO stock_updates_audit VALUES (new.lcsc); END;
    `)

    const batchFiles = (await readdir(outputDirectory)).sort()
    for (const batchFile of batchFiles) {
      target.exec(await readFile(path.join(outputDirectory, batchFile), "utf8"))
    }

    for (const table of ["component_catalog", "search_index"]) {
      expect(
        target.query(`SELECT lcsc, stock FROM ${table} ORDER BY lcsc`).all(),
      ).toEqual([
        { lcsc: 1, stock: 10 },
        { lcsc: 2, stock: null },
        { lcsc: 3, stock: 0 },
        { lcsc: 99, stock: 99 },
      ])
    }

    const updatesBeforeRetry = target
      .query<{ count: number }, []>(
        "SELECT COUNT(*) AS count FROM stock_updates_audit",
      )
      .get()?.count
    expect(updatesBeforeRetry).toBe(4)
    for (const batchFile of batchFiles) {
      target.exec(await readFile(path.join(outputDirectory, batchFile), "utf8"))
    }
    const updatesAfterRetry = target
      .query<{ count: number }, []>(
        "SELECT COUNT(*) AS count FROM stock_updates_audit",
      )
      .get()?.count
    expect(updatesAfterRetry).toBe(updatesBeforeRetry)
    target.close()
  })

  test("rejects duplicate component identifiers", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (lcsc INTEGER, stock INTEGER);
      INSERT INTO component_stock(lcsc, stock) VALUES (1, 10), (1, 20);
    `)
    source.close()

    expect(
      writeStockSyncBatches({
        sourcePath,
        outputDirectory: path.join(directory, "batches"),
      }),
    ).rejects.toThrow("component_stock.lcsc must be unique and non-null")
  })

  test("discovers deployed categories and refreshes their stock and availability", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const outputDirectory = path.join(directory, "batches")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      INSERT INTO component_stock VALUES (221660, 0), (2, 20), (3, 10), (4, NULL);
    `)
    source.close()

    const target = new Database(":memory:")
    target.exec(`
      CREATE TABLE component_catalog (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      CREATE TABLE search_index (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      CREATE TABLE switch (lcsc INTEGER PRIMARY KEY, stock INTEGER, in_stock INTEGER, description TEXT);
      CREATE TABLE resistor (lcsc INTEGER PRIMARY KEY, stock INTEGER, in_stock INTEGER);
      CREATE TABLE footprinter_strings (lcsc INTEGER PRIMARY KEY, footprinter_string TEXT);
      CREATE TABLE _jlcsearch_stock_sync_batch (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      CREATE VIEW switches_view AS SELECT * FROM switch;
      INSERT INTO component_catalog VALUES (221660, 2184);
      INSERT INTO search_index VALUES (221660, 2184);
      INSERT INTO switch VALUES
        (221660, 2184, 1, 'Side-facing power switch'),
        (2, 0, 0, 'Restocked'), (3, 10, 0, 'Incorrect flag'),
        (4, 1, 1, 'Unknown quantity'), (99, 99, 1, 'Missing from snapshot');
      INSERT INTO resistor VALUES (2, 0, 0);
    `)
    const targets = target
      .query<StockSyncTarget, []>(STOCK_SYNC_TARGETS_QUERY)
      .all()
    expect(targets).toEqual([
      { name: "component_catalog", has_in_stock: 0 },
      { name: "resistor", has_in_stock: 1 },
      { name: "search_index", has_in_stock: 0 },
      { name: "switch", has_in_stock: 1 },
    ])
    await writeStockSyncBatches({
      sourcePath,
      outputDirectory,
      batchSize: 2,
      targets,
    })
    for (const file of (await readdir(outputDirectory)).sort()) {
      target.exec(await readFile(path.join(outputDirectory, file), "utf8"))
    }
    expect(target.query("SELECT * FROM switch ORDER BY lcsc").all()).toEqual([
      { lcsc: 2, stock: 20, in_stock: 1, description: "Restocked" },
      { lcsc: 3, stock: 10, in_stock: 1, description: "Incorrect flag" },
      { lcsc: 4, stock: null, in_stock: 0, description: "Unknown quantity" },
      {
        lcsc: 99,
        stock: 99,
        in_stock: 1,
        description: "Missing from snapshot",
      },
      {
        lcsc: 221660,
        stock: 0,
        in_stock: 0,
        description: "Side-facing power switch",
      },
    ])
    expect(target.query("SELECT * FROM resistor").all()).toEqual([
      { lcsc: 2, stock: 20, in_stock: 1 },
    ])
    for (const table of ["component_catalog", "search_index"]) {
      expect(
        target.query(`SELECT stock FROM ${table} WHERE lcsc=221660`).get(),
      ).toEqual({ stock: 0 })
    }
    expect(
      target
        .query(
          "SELECT name FROM sqlite_master WHERE name = '_jlcsearch_stock_sync_batch'",
        )
        .get(),
    ).toBeNull()
    target.close()
  })

  test("retries a partially applied batch and removes its staging table", () => {
    const target = new Database(":memory:")
    target.exec(`
      CREATE TABLE switch (lcsc INTEGER PRIMARY KEY, stock INTEGER, in_stock INTEGER);
      INSERT INTO switch VALUES (221660, 2184, 1);
    `)
    const batch = createStockSyncBatchSql(
      [{ lcsc: 221660, stock: 0 }],
      [{ name: "switch", has_in_stock: 1 }],
    )
    target.exec(batch.slice(0, batch.indexOf("UPDATE")))
    target.exec(batch)
    target.exec(batch)
    expect(target.query("SELECT * FROM switch").all()).toEqual([
      { lcsc: 221660, stock: 0, in_stock: 0 },
    ])
    target.close()
  })

  test("validates the remote discovery result before generating updates", async () => {
    const directory = await createTempDirectory()
    const filename = path.join(directory, "targets.json")
    const targets = [
      { name: "component_catalog", has_in_stock: 0 },
      { name: "search_index", has_in_stock: 0 },
      { name: "switch", has_in_stock: 1 },
    ]
    const writeTargets = async (results: unknown) =>
      writeFile(filename, JSON.stringify([{ success: true, results }]))
    await writeTargets(targets)
    expect(await readStockSyncTargets(filename)).toEqual(targets)
    await writeTargets(targets.slice(1))
    await expect(readStockSyncTargets(filename)).rejects.toThrow(
      "Missing required stock table",
    )
    await writeTargets([
      ...targets,
      { name: "bad; DROP TABLE switch", has_in_stock: 1 },
    ])
    await expect(readStockSyncTargets(filename)).rejects.toThrow(
      "Invalid stock sync target",
    )
    await writeTargets([...targets, targets[2]])
    await expect(readStockSyncTargets(filename)).rejects.toThrow(
      "Invalid stock sync target",
    )
    await writeFile(
      filename,
      JSON.stringify([{ success: false, results: targets }]),
    )
    await expect(readStockSyncTargets(filename)).rejects.toThrow(
      "Invalid D1 stock target discovery response",
    )
  })

  test("sync-stock.sh discovers remote categories and uploads generated batches", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const targetPath = path.join(directory, "target.sqlite3")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      INSERT INTO component_stock VALUES (221660, 0), (2, 20);
    `)
    source.close()
    const target = new Database(targetPath, { create: true })
    target.exec(`
      CREATE TABLE component_catalog (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      CREATE TABLE search_index (lcsc INTEGER PRIMARY KEY, stock INTEGER);
      CREATE TABLE switch (lcsc INTEGER PRIMARY KEY, stock INTEGER, in_stock INTEGER);
      INSERT INTO switch VALUES (221660, 2184, 1), (2, 0, 0);
    `)
    target.close()

    const mockWrangler = path.join(directory, "wrangler.ts")
    await writeFile(
      mockWrangler,
      `
      import { Database } from "bun:sqlite"
      const args = process.argv.slice(2)
      if (args.slice(0, 4).join(" ") !== "wrangler d1 execute jlcsearch" || !args.includes("--remote")) {
        throw new Error("Unexpected Wrangler arguments")
      }
      const db = new Database(process.env.MOCK_D1_PATH!)
      const sql = args[args.indexOf("--command") + 1]
      if (args.includes("--json")) {
        console.log(JSON.stringify([{ success: true, results: db.query(sql).all() }]))
      } else {
        db.exec(sql)
      }
      db.close()
    `,
    )
    const bunxPath = path.join(directory, "bunx")
    await writeFile(
      bunxPath,
      '#!/usr/bin/env bash\nexec "$MOCK_BUN" "$MOCK_WRANGLER_SCRIPT" "$@"\n',
    )
    await chmod(bunxPath, 0o755)
    await symlink(process.execPath, path.join(directory, "bun"))
    const processResult = Bun.spawn(
      [
        "bash",
        path.resolve(import.meta.dir, "../cf-proxy/scripts/sync-stock.sh"),
      ],
      {
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          DB_NAME: "jlcsearch",
          SOURCE_DB_PATH: sourcePath,
          STOCK_BATCH_ROWS: "1",
          RETRY_MAX_ATTEMPTS: "1",
          MOCK_BUN: process.execPath,
          MOCK_WRANGLER_SCRIPT: mockWrangler,
          MOCK_D1_PATH: targetPath,
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      processResult.exited,
      new Response(processResult.stdout).text(),
      new Response(processResult.stderr).text(),
    ])
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
    expect(stdout).toContain("across 3 tables")
    const synced = new Database(targetPath, { readonly: true })
    expect(synced.query("SELECT * FROM switch ORDER BY lcsc").all()).toEqual([
      { lcsc: 2, stock: 20, in_stock: 1 },
      { lcsc: 221660, stock: 0, in_stock: 0 },
    ])
    synced.close()
  })

  test("keeps a 1,000-row batch for all categories below D1 and command-size limits", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lcsc: 9_000_000 + index,
      stock: 999_999_999,
    }))
    const targets = Array.from({ length: 60 }, (_, index) => ({
      name: `category_with_long_table_name_${index}`,
      has_in_stock: 1,
    }))
    const batch = createStockSyncBatchSql(rows, targets)
    const statements = batch.split(";\n")

    expect(Buffer.byteLength(batch)).toBeLessThan(100_000)
    for (const statement of statements) {
      expect(Buffer.byteLength(statement)).toBeLessThan(100_000)
    }
  })
})
