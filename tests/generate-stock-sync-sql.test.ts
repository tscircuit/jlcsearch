import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DERIVED_TABLES } from "../lib/db/derivedtables/setup-derived-tables"
import {
  createStockSyncBatchSql,
  getDerivedPreferredTargets,
  parseStockSyncSchema,
  STOCK_SYNC_SCHEMA_QUERY,
  writeStockSyncBatches,
} from "../scripts/generate-stock-sync-sql"

const tempDirectories: string[] = []
const coreSchema = ["component_catalog", "search_index"].flatMap((table_name) =>
  ["lcsc", "stock", "preferred"].map((column_name) => ({
    table_name,
    column_name,
  })),
)
const derivedSchema = (
  table_name: string,
  columns = ["lcsc", "is_preferred"],
) => columns.map((column_name) => ({ table_name, column_name }))

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
  test("refreshes started and ended promotions even when stock is unchanged, preserving unknown rows", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const outputDirectory = path.join(directory, "batches")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (lcsc INTEGER, stock INTEGER, preferred INTEGER);
      INSERT INTO component_stock(lcsc, stock, preferred) VALUES
        (1, 10, 1),
        (2, NULL, 0),
        (3, 0, 0),
        (4, 40, 1);
    `)
    source.close()

    const result = await writeStockSyncBatches({
      sourcePath,
      outputDirectory,
      batchSize: 2,
      targetSchema: [
        ...coreSchema,
        ...derivedSchema("resistor"),
        ...derivedSchema("capacitor", ["lcsc"]),
      ],
    })
    expect(result).toEqual({ rowCount: 4, batchCount: 2 })

    const target = new Database(":memory:")
    target.exec(`
      CREATE TABLE component_catalog (lcsc INTEGER UNIQUE, stock INTEGER, preferred INTEGER);
      CREATE TABLE search_index (lcsc INTEGER UNIQUE, stock INTEGER, preferred INTEGER);
      CREATE TABLE resistor (lcsc INTEGER UNIQUE, is_preferred INTEGER);
      CREATE TABLE capacitor (lcsc INTEGER UNIQUE);
      INSERT INTO component_catalog(lcsc, stock, preferred) VALUES
        (1, 10, 0), (2, NULL, 1), (3, 3, 1), (99, 99, 1);
      INSERT INTO search_index(lcsc, stock, preferred) VALUES
        (1, 10, 0), (2, NULL, 1), (3, 3, 1), (99, 99, 1);
      INSERT INTO resistor(lcsc, is_preferred) VALUES
        (1, 0), (2, 1), (3, 1), (4, 0), (99, 0), (100, 1);
    `)

    const batchFiles = (await readdir(outputDirectory)).sort()
    for (const [index, batchFile] of batchFiles.entries()) {
      target.exec(await readFile(path.join(outputDirectory, batchFile), "utf8"))
      if (index === 0) {
        expect(
          target
            .query("SELECT is_preferred FROM resistor WHERE lcsc = 3")
            .get(),
        ).toEqual({ is_preferred: 1 })
      }
    }

    for (const table of ["component_catalog", "search_index"]) {
      expect(
        target
          .query(`SELECT lcsc, stock, preferred FROM ${table} ORDER BY lcsc`)
          .all(),
      ).toEqual([
        { lcsc: 1, stock: 10, preferred: 1 },
        { lcsc: 2, stock: null, preferred: 0 },
        { lcsc: 3, stock: 0, preferred: 0 },
        { lcsc: 99, stock: 99, preferred: 1 },
      ])
    }
    expect(target.query("SELECT * FROM resistor ORDER BY lcsc").all()).toEqual([
      { lcsc: 1, is_preferred: 1 },
      { lcsc: 2, is_preferred: 0 },
      { lcsc: 3, is_preferred: 0 },
      { lcsc: 4, is_preferred: 0 },
      { lcsc: 99, is_preferred: 0 },
      { lcsc: 100, is_preferred: 1 },
    ])

    const changesBeforeRetry = target
      .query<{ changes: number }, []>("SELECT total_changes() AS changes")
      .get()?.changes
    for (const batchFile of batchFiles) {
      target.exec(await readFile(path.join(outputDirectory, batchFile), "utf8"))
    }
    const changesAfterRetry = target
      .query<{ changes: number }, []>("SELECT total_changes() AS changes")
      .get()?.changes
    expect(changesAfterRetry).toBe(changesBeforeRetry)
    target.close()
  })

  test("rejects duplicate component identifiers", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (lcsc INTEGER, stock INTEGER, preferred INTEGER);
      INSERT INTO component_stock(lcsc, stock, preferred) VALUES (1, 10, 0), (1, 20, 0);
    `)
    source.close()

    expect(
      writeStockSyncBatches({
        sourcePath,
        outputDirectory: path.join(directory, "batches"),
        targetSchema: coreSchema,
      }),
    ).rejects.toThrow("component_stock.lcsc must be unique and non-null")
  })

  test("keeps 1,000-row statements below D1's query-size limit", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lcsc: Number.MAX_SAFE_INTEGER - index,
      stock: Number.MAX_SAFE_INTEGER,
      preferred: 1,
    }))
    const statements = createStockSyncBatchSql(rows, ["resistor"]).split(";\n")

    expect(statements).toHaveLength(3)
    for (const statement of statements) {
      expect(Buffer.byteLength(statement)).toBeLessThan(100_000)
    }
    expect(() => createStockSyncBatchSql([...rows, rows[0]])).toThrow(
      "at most 1000",
    )
    expect(() => createStockSyncBatchSql(rows, ["unknown_table"])).toThrow(
      "Unknown preferred table",
    )
  })

  test("uses only known tables with deployed lcsc and flag columns", () => {
    expect(
      getDerivedPreferredTargets([
        ...coreSchema,
        ...derivedSchema("resistor"),
        ...derivedSchema("capacitor", ["lcsc"]),
        ...derivedSchema("unrelated_table"),
        ...derivedSchema("resistor; DROP TABLE component_catalog;--"),
      ]),
    ).toEqual(["resistor"])
    expect(getDerivedPreferredTargets(coreSchema)).toEqual([])
    expect(() =>
      getDerivedPreferredTargets([
        ...coreSchema,
        ...derivedSchema("resistor", ["is_preferred"]),
      ]),
    ).toThrow("resistor.lcsc")
    expect(() =>
      getDerivedPreferredTargets(
        coreSchema.filter((c) => c.column_name !== "preferred"),
      ),
    ).toThrow("component_catalog.preferred")
    expect(() => getDerivedPreferredTargets([null] as never)).toThrow(
      "Invalid stock sync schema metadata",
    )
  })

  test("bounds complete commands with every deployed preferred table and large identifiers", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const outputDirectory = path.join(directory, "batches")
    const tables = DERIVED_TABLES.filter((table) =>
      table.extraColumns.some((column) => column.name === "is_preferred"),
    ).map((table) => table.tableName)
    const ids = Array.from(
      { length: 1000 },
      (_, i) => Number.MAX_SAFE_INTEGER - i,
    )
    const values = ids
      .map((lcsc) => `(${lcsc},${Number.MAX_SAFE_INTEGER},1)`)
      .join(",")
    const source = new Database(sourcePath)
    source.exec(
      `CREATE TABLE component_stock(lcsc INTEGER PRIMARY KEY, stock INTEGER, preferred INTEGER); INSERT INTO component_stock VALUES ${values}`,
    )
    source.close()
    const result = await writeStockSyncBatches({
      sourcePath,
      outputDirectory,
      targetSchema: [
        ...coreSchema,
        ...tables.flatMap((table) => derivedSchema(table)),
      ],
    })
    expect(result.batchCount).toBeGreaterThan(1)
    const target = new Database(":memory:")
    try {
      target.exec(
        `CREATE TABLE component_catalog(lcsc INTEGER PRIMARY KEY, stock INTEGER, preferred INTEGER); INSERT INTO component_catalog VALUES ${values}; UPDATE component_catalog SET preferred=0; CREATE TABLE search_index AS SELECT * FROM component_catalog`,
      )
      for (const table of tables)
        target.exec(
          `CREATE TABLE ${table}(lcsc INTEGER PRIMARY KEY, is_preferred INTEGER); INSERT INTO ${table} SELECT lcsc, preferred FROM component_catalog`,
        )
      for (const file of (await readdir(outputDirectory)).sort()) {
        const command = await readFile(path.join(outputDirectory, file), "utf8")
        expect(Buffer.byteLength(command)).toBeLessThanOrEqual(100_000)
        target.exec(command)
      }
      for (const table of tables) {
        expect(
          target
            .query(
              `SELECT COUNT(*) AS count FROM ${table} WHERE is_preferred=1`,
            )
            .get(),
        ).toEqual({ count: 1000 })
      }
    } finally {
      target.close()
    }
  })

  test("fails closed on unsuccessful or incomplete discovery responses", () => {
    expect(
      parseStockSyncSchema([{ success: true, results: coreSchema }]),
    ).toEqual(coreSchema)
    for (const response of [
      null,
      [],
      [{ success: false, results: coreSchema }],
      [{ success: true, results: [] }],
    ]) {
      expect(() => parseStockSyncSchema(response)).toThrow()
    }
  })

  test("rejects invalid or unknown snapshot flags instead of silently clearing promotions", () => {
    for (const preferred of [null, undefined, -1, 2, "1"]) {
      expect(() =>
        createStockSyncBatchSql([{ lcsc: 1, stock: 10, preferred }] as never),
      ).toThrow("preferred must be 0 or 1")
    }
  })

  test("caps configured row counts before producing SQL", async () => {
    for (const batchSize of [0, -1, 1001, Number.NaN, 1.5]) {
      await expect(
        writeStockSyncBatches({
          sourcePath: "unused",
          outputDirectory: "unused",
          batchSize,
          targetSchema: coreSchema,
        }),
      ).rejects.toThrow("between 1 and 1000")
    }
  })

  test("upload script discovers only real tables and retries schema reads and updates using local mock Wrangler", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const targetPath = path.join(directory, "target.sqlite3")
    const callsPath = path.join(directory, "calls.jsonl")
    const source = new Database(sourcePath)
    source.exec(
      "CREATE TABLE component_stock(lcsc INTEGER, stock INTEGER, preferred INTEGER); INSERT INTO component_stock VALUES (1, 10, 1), (2, 20, 0);",
    )
    source.close()
    const target = new Database(targetPath)
    target.exec(`
      CREATE TABLE component_catalog(lcsc INTEGER PRIMARY KEY, stock INTEGER, preferred INTEGER);
      CREATE TABLE search_index(lcsc INTEGER PRIMARY KEY, stock INTEGER, preferred INTEGER);
      CREATE TABLE resistor(lcsc INTEGER PRIMARY KEY, is_preferred INTEGER);
      CREATE TABLE capacitor(lcsc INTEGER PRIMARY KEY);
      INSERT INTO component_catalog VALUES (1, 10, 0), (2, 20, 1);
      INSERT INTO search_index SELECT * FROM component_catalog;
      INSERT INTO resistor VALUES (1, 0), (2, 1);
    `)
    expect(
      getDerivedPreferredTargets(
        target.query(STOCK_SYNC_SCHEMA_QUERY).all() as never,
      ),
    ).toEqual(["resistor"])
    target.close()
    const bin = path.join(directory, "bin")
    await mkdir(bin)
    await symlink(process.execPath, path.join(bin, "bun"))
    const mockWrangler = path.join(bin, "bunx")
    await Bun.write(
      mockWrangler,
      `#!${process.execPath}
import { Database } from "bun:sqlite";
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args[0] !== "wrangler" || args[1] !== "d1" || args[2] !== "execute" || !args.includes("--remote")) throw new Error("Unexpected mock command");
const schema = args.includes("--json");
if (args.includes("--file")) throw new Error("Stock refresh must use the query endpoint, not a blocking import");
const sql = args[args.indexOf("--command") + 1];
appendFileSync(process.env.MOCK_CALLS_PATH, JSON.stringify({schema, sql, file: args.includes("--file")}) + "\\n");
const marker = process.env.MOCK_CALLS_PATH + (schema ? ".schema-retried" : ".update-retried");
if (schema && !existsSync(marker)) { writeFileSync(marker, "1"); console.log("incomplete response"); process.exit(1); }
const db = new Database(process.env.MOCK_TARGET_PATH);
if (schema) console.log(JSON.stringify([{success: true, results: db.query(sql).all()}]));
else { db.exec(sql); if (!existsSync(marker)) { writeFileSync(marker, "1"); db.close(); process.exit(1); } }
db.close();
`,
    )
    await chmod(mockWrangler, 0o755)
    const subprocess = Bun.spawn(
      ["/bin/bash", path.resolve("cf-proxy/scripts/sync-stock.sh")],
      {
        env: {
          PATH: `${bin}:/usr/bin:/bin`,
          SOURCE_DB_PATH: sourcePath,
          MOCK_TARGET_PATH: targetPath,
          MOCK_CALLS_PATH: callsPath,
          RETRY_BASE_DELAY_SECONDS: "0",
          RETRY_MAX_ATTEMPTS: "2",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const stdout = await new Response(subprocess.stdout).text()
    const stderr = await new Response(subprocess.stderr).text()
    expect(await subprocess.exited).toBe(0)
    expect(stderr.trim().split("\n")).toEqual([
      "::warning::Command failed on attempt 1/2; retrying in 0s.",
      "::warning::Command failed on attempt 1/2; retrying in 0s.",
    ])
    expect(stdout).toContain("Stock and promotional-flag sync complete.")
    const result = new Database(targetPath)
    expect(result.query("SELECT * FROM resistor ORDER BY lcsc").all()).toEqual([
      { lcsc: 1, is_preferred: 1 },
      { lcsc: 2, is_preferred: 0 },
    ])
    expect(
      result
        .query("SELECT stock, preferred FROM search_index ORDER BY lcsc")
        .all(),
    ).toEqual([
      { stock: 10, preferred: 1 },
      { stock: 20, preferred: 0 },
    ])
    const calls = (await readFile(callsPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
    expect(calls.filter((call) => call.schema)).toHaveLength(2)
    expect(calls.filter((call) => !call.schema)).toHaveLength(2)
    expect(
      calls.filter((call) => !call.schema).every((call) => !call.file),
    ).toBe(true)
    expect(
      calls
        .filter((call) => !call.schema)
        .some((call) => call.sql.includes("UPDATE capacitor")),
    ).toBe(false)
    result.close()
  })
})
