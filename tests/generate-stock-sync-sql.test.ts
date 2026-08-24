import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createStockSyncBatchLcscList,
  createStockSyncBatchSql,
  writeStockSyncBatches,
} from "../scripts/generate-stock-sync-sql"
import {
  createCombinedStockPropagationSql,
  createDerivedTablePropagationSql,
  createSearchIndexPropagationSql,
} from "../scripts/stock-sync-propagation-sql"

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
  test("updates stock and classification in the component catalog source of truth", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const outputDirectory = path.join(directory, "batches")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (
        lcsc INTEGER,
        stock INTEGER,
        basic INTEGER NOT NULL,
        preferred INTEGER NOT NULL,
        is_extended_promotional INTEGER NOT NULL
      );
      INSERT INTO component_stock(
        lcsc,
        stock,
        basic,
        preferred,
        is_extended_promotional
      ) VALUES
        (1, 10, 0, 1, 1),
        (2, NULL, 1, 1, 0),
        (3, 0, 0, 0, 0),
        (4, 40, 0, 1, 1);
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
      CREATE TABLE component_catalog (
        lcsc INTEGER UNIQUE,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER,
        is_extended_promotional INTEGER,
        description TEXT
      );
      CREATE TABLE search_index (
        lcsc INTEGER UNIQUE,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER,
        description TEXT
      );
      INSERT INTO component_catalog(
        lcsc,
        stock,
        basic,
        preferred,
        is_extended_promotional,
        description
      ) VALUES
        (1, 1, 0, 0, 0, 'changes classification'),
        (2, NULL, 1, 1, 0, 'already identical'),
        (3, 3, 1, 1, 0, 'changes stock and classification'),
        (99, 99, 1, 0, 0, 'unrelated row');
      INSERT INTO search_index(
        lcsc,
        stock,
        basic,
        preferred,
        description
      ) VALUES
        (1, 1, 0, 0, 'not touched by stock batch'),
        (2, NULL, 1, 1, 'not touched by stock batch'),
        (3, 3, 1, 1, 'not touched by stock batch'),
        (99, 99, 1, 0, 'unrelated row');
    `)

    const outputFiles = await readdir(outputDirectory)
    const batchFiles = outputFiles
      .filter((file) => file.endsWith(".sql"))
      .sort()
    const lcscFiles = outputFiles
      .filter((file) => file.endsWith(".lcsc"))
      .sort()
    expect(batchFiles).toEqual(["batch-000001.sql", "batch-000002.sql"])
    expect(lcscFiles).toEqual(["batch-000001.lcsc", "batch-000002.lcsc"])
    expect(
      await readFile(path.join(outputDirectory, lcscFiles[0]!), "utf8"),
    ).toBe(`1\n2\n`)
    for (const batchFile of batchFiles) {
      target.exec(await readFile(path.join(outputDirectory, batchFile), "utf8"))
    }

    expect(
      target
        .query(
          `SELECT lcsc, stock, basic, preferred, is_extended_promotional, description
           FROM component_catalog
           ORDER BY lcsc`,
        )
        .all(),
    ).toEqual([
      {
        lcsc: 1,
        stock: 10,
        basic: 0,
        preferred: 1,
        is_extended_promotional: 1,
        description: "changes classification",
      },
      {
        lcsc: 2,
        stock: null,
        basic: 1,
        preferred: 1,
        is_extended_promotional: 0,
        description: "already identical",
      },
      {
        lcsc: 3,
        stock: 0,
        basic: 0,
        preferred: 0,
        is_extended_promotional: 0,
        description: "changes stock and classification",
      },
      {
        lcsc: 99,
        stock: 99,
        basic: 1,
        preferred: 0,
        is_extended_promotional: 0,
        description: "unrelated row",
      },
    ])
    expect(
      target
        .query(
          `SELECT lcsc, stock, basic, preferred, description
           FROM search_index
           ORDER BY lcsc`,
        )
        .all(),
    ).toEqual([
      {
        lcsc: 1,
        stock: 1,
        basic: 0,
        preferred: 0,
        description: "not touched by stock batch",
      },
      {
        lcsc: 2,
        stock: null,
        basic: 1,
        preferred: 1,
        description: "not touched by stock batch",
      },
      {
        lcsc: 3,
        stock: 3,
        basic: 1,
        preferred: 1,
        description: "not touched by stock batch",
      },
      {
        lcsc: 99,
        stock: 99,
        basic: 1,
        preferred: 0,
        description: "unrelated row",
      },
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

  test("rolls out stale schemas and propagates classification to served tables", () => {
    const target = new Database(":memory:")
    target.exec(`
      CREATE TABLE component_catalog (
        lcsc INTEGER UNIQUE,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER,
        description TEXT
      );
      CREATE TABLE search_index (
        lcsc INTEGER UNIQUE,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER,
        description TEXT
      );
      CREATE TABLE hdmi_port (
        lcsc INTEGER PRIMARY KEY,
        stock INTEGER,
        in_stock INTEGER,
        is_basic INTEGER,
        is_preferred INTEGER,
        description TEXT
      );
      INSERT INTO component_catalog(lcsc, stock, basic, preferred, description)
      VALUES
        (1, 10, 0, 1, 'true to false'),
        (2, 20, 1, 0, 'false to true'),
        (99, 99, 1, 1, 'unrelated');
      INSERT INTO search_index(lcsc, stock, basic, preferred, description)
      SELECT lcsc, stock, basic, preferred, description FROM component_catalog;
      INSERT INTO hdmi_port(lcsc, stock, in_stock, is_basic, is_preferred, description)
      VALUES
        (1, 10, 1, 0, 1, 'true to false'),
        (2, 20, 1, 1, 0, 'false to true'),
        (99, 99, 1, 1, 1, 'unrelated');
    `)

    target.exec(`
      ALTER TABLE component_catalog ADD COLUMN is_extended_promotional INTEGER;
      UPDATE component_catalog
      SET is_extended_promotional = CASE
        WHEN basic = 0 AND preferred = 1 THEN 1
        ELSE 0
      END
      WHERE is_extended_promotional IS NULL;
    `)
    target.exec(
      createStockSyncBatchSql([
        {
          lcsc: 1,
          stock: 11,
          basic: 1,
          preferred: 1,
          is_extended_promotional: 0,
        },
        {
          lcsc: 2,
          stock: 22,
          basic: 0,
          preferred: 1,
          is_extended_promotional: 1,
        },
      ]),
    )
    target.exec(`
      ALTER TABLE search_index ADD COLUMN is_extended_promotional INTEGER;
      ALTER TABLE hdmi_port ADD COLUMN is_extended_promotional INTEGER;
    `)
    target.exec(createSearchIndexPropagationSql([1, 2]))
    expect(
      target
        .query(
          `SELECT lcsc, stock, is_extended_promotional
           FROM hdmi_port
           WHERE lcsc IN (1, 2)
           ORDER BY lcsc`,
        )
        .all(),
    ).toEqual([
      { lcsc: 1, stock: 10, is_extended_promotional: null },
      { lcsc: 2, stock: 20, is_extended_promotional: null },
    ])
    target.exec(createSearchIndexPropagationSql([1, 2]))
    target.exec(createDerivedTablePropagationSql("hdmi_port", [1, 2]))

    expect(
      target
        .query(
          `SELECT
             c.lcsc,
             c.stock AS catalog_stock,
             s.stock AS search_stock,
             h.stock AS derived_stock,
             h.in_stock AS derived_in_stock,
             c.basic AS catalog_basic,
             s.basic AS search_basic,
             h.is_basic AS derived_basic,
             c.preferred AS catalog_preferred,
             s.preferred AS search_preferred,
             h.is_preferred AS derived_preferred,
             c.is_extended_promotional AS catalog_extended,
             s.is_extended_promotional AS search_extended,
             h.is_extended_promotional AS derived_extended
           FROM component_catalog c
           JOIN search_index s ON s.lcsc = c.lcsc
           JOIN hdmi_port h ON h.lcsc = c.lcsc
           ORDER BY c.lcsc`,
        )
        .all(),
    ).toEqual([
      {
        lcsc: 1,
        catalog_stock: 11,
        search_stock: 11,
        derived_stock: 11,
        derived_in_stock: 1,
        catalog_basic: 1,
        search_basic: 1,
        derived_basic: 1,
        catalog_preferred: 1,
        search_preferred: 1,
        derived_preferred: 1,
        catalog_extended: 0,
        search_extended: 0,
        derived_extended: 0,
      },
      {
        lcsc: 2,
        catalog_stock: 22,
        search_stock: 22,
        derived_stock: 22,
        derived_in_stock: 1,
        catalog_basic: 0,
        search_basic: 0,
        derived_basic: 0,
        catalog_preferred: 1,
        search_preferred: 1,
        derived_preferred: 1,
        catalog_extended: 1,
        search_extended: 1,
        derived_extended: 1,
      },
      {
        lcsc: 99,
        catalog_stock: 99,
        search_stock: 99,
        derived_stock: 99,
        derived_in_stock: 1,
        catalog_basic: 1,
        search_basic: 1,
        derived_basic: 1,
        catalog_preferred: 1,
        search_preferred: 1,
        derived_preferred: 1,
        catalog_extended: 0,
        search_extended: null,
        derived_extended: null,
      },
    ])

    const changesBeforeRetry = target
      .query<{ changes: number }, []>("SELECT total_changes() AS changes")
      .get()?.changes
    target.exec(createSearchIndexPropagationSql([1, 2]))
    target.exec(createDerivedTablePropagationSql("hdmi_port", [1, 2]))
    const changesAfterRetry = target
      .query<{ changes: number }, []>("SELECT total_changes() AS changes")
      .get()?.changes
    expect(changesAfterRetry).toBe(changesBeforeRetry)
    target.close()
  })

  test("propagates stock classification per bounded LCSC batch through sync-stock", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const remotePath = path.join(directory, "remote.sqlite3")
    const fakeBinDirectory = path.join(directory, "bin")
    const fakeWranglerPath = path.join(directory, "fake-wrangler.ts")
    const fakeBunxPath = path.join(fakeBinDirectory, "bunx")
    const logPath = path.join(directory, "wrangler.log")

    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (
        lcsc INTEGER,
        stock INTEGER,
        basic INTEGER NOT NULL,
        preferred INTEGER NOT NULL,
        is_extended_promotional INTEGER NOT NULL
      );
      INSERT INTO component_stock(
        lcsc,
        stock,
        basic,
        preferred,
        is_extended_promotional
      ) VALUES
        (1, 11, 0, 1, 1),
        (2, 22, 1, 1, 0),
        (3, 33, 1, 0, 0),
        (4, 44, 0, 1, 1),
        (5, 55, 0, 0, 0);
    `)
    source.close()

    const remote = new Database(remotePath, { create: true })
    remote.exec(`
      CREATE TABLE component_catalog (
        lcsc INTEGER UNIQUE,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER,
        description TEXT
      );
      CREATE TABLE search_index (
        lcsc INTEGER UNIQUE,
        stock INTEGER,
        basic INTEGER,
        preferred INTEGER,
        description TEXT
      );
      CREATE TABLE hdmi_port (
        lcsc INTEGER PRIMARY KEY,
        stock INTEGER,
        in_stock INTEGER,
        is_basic INTEGER,
        is_preferred INTEGER,
        description TEXT
      );
      CREATE TABLE usb_c_connector (
        lcsc INTEGER PRIMARY KEY,
        stock INTEGER,
        in_stock INTEGER,
        is_basic INTEGER,
        is_preferred INTEGER,
        description TEXT
      );
      INSERT INTO component_catalog(lcsc, stock, basic, preferred, description)
      VALUES
        (1, 1, 1, 1, 'false to true'),
        (2, 2, 0, 1, 'true to false'),
        (3, 33, 1, 0, 'unchanged'),
        (4, 4, 1, 0, 'target missing from derived'),
        (5, 5, 1, 0, 'final short batch'),
        (999, 999, 1, 1, 'unrelated');
      INSERT INTO search_index(lcsc, stock, basic, preferred, description)
      SELECT lcsc, stock, basic, preferred, description FROM component_catalog;
      INSERT INTO hdmi_port(lcsc, stock, in_stock, is_basic, is_preferred, description)
      VALUES
        (1, 1, 1, 1, 1, 'false to true'),
        (2, 2, 1, 0, 1, 'true to false'),
        (3, 33, 1, 1, 0, 'unchanged'),
        (5, 5, 1, 1, 0, 'final short batch'),
        (999, 999, 1, 1, 1, 'unrelated');
      INSERT INTO usb_c_connector(lcsc, stock, in_stock, is_basic, is_preferred, description)
      SELECT lcsc, stock, in_stock, is_basic, is_preferred, description
      FROM hdmi_port;
    `)
    remote.close()

    await mkdir(fakeBinDirectory, { recursive: true })
    await Bun.write(
      fakeWranglerPath,
      `
import { Database } from "bun:sqlite"
import { appendFileSync, readFileSync } from "node:fs"

const args = Bun.argv.slice(2)
if (args[0] !== "wrangler" || args[1] !== "d1" || args[2] !== "execute") {
  throw new Error(\`Unexpected command: \${args.join(" ")}\`)
}

const commandIndex = args.indexOf("--command")
const fileEqualsArg = args.find((arg) => arg.startsWith("--file="))
const fileIndex = args.indexOf("--file")
const sql =
  commandIndex >= 0
    ? args[commandIndex + 1]
    : fileEqualsArg
      ? readFileSync(fileEqualsArg.slice("--file=".length), "utf8")
      : fileIndex >= 0
        ? readFileSync(args[fileIndex + 1], "utf8")
        : null

if (!sql) throw new Error(\`Missing SQL in command: \${args.join(" ")}\`)
appendFileSync(process.env.FAKE_WRANGLER_LOG!, \`---SQL---\\n\${sql}\\n\`)

const database = new Database(process.env.FAKE_D1_PATH!)
try {
  if (args.includes("--json")) {
    console.log(JSON.stringify([{ results: database.query(sql).all() }]))
  } else {
    database.exec(sql)
    console.log(JSON.stringify([{ results: [] }]))
  }
} finally {
  database.close()
}
`.trim(),
    )
    await Bun.write(
      fakeBunxPath,
      `#!/usr/bin/env bash\n"${process.execPath}" "${fakeWranglerPath}" "$@"\n`,
    )
    await chmod(fakeBunxPath, 0o755)

    const firstRun = Bun.spawn({
      cmd: ["bash", "cf-proxy/scripts/sync-stock.sh"],
      cwd: path.resolve(import.meta.dir, ".."),
      env: {
        ...process.env,
        DB_NAME: "test",
        SOURCE_DB_PATH: sourcePath,
        STOCK_BATCH_ROWS: "2",
        DERIVED_STOCK_TABLES_LIST: "hdmi_port,usb_c_connector",
        FAKE_D1_PATH: remotePath,
        FAKE_WRANGLER_LOG: logPath,
        PATH: `${fakeBinDirectory}:${path.dirname(process.execPath)}:${process.env.PATH ?? ""}`,
        RETRY_MAX_ATTEMPTS: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [firstExitCode, firstStdout, firstStderr] = await Promise.all([
      firstRun.exited,
      new Response(firstRun.stdout).text(),
      new Response(firstRun.stderr).text(),
    ])
    expect({ firstExitCode, firstStdout, firstStderr }).toMatchObject({
      firstExitCode: 0,
    })

    const proof = new Database(remotePath)
    try {
      expect(
        proof
          .query(
            `SELECT
               c.lcsc,
               c.stock AS catalog_stock,
               s.stock AS search_stock,
               h.stock AS derived_stock,
               h.in_stock AS derived_in_stock,
               c.basic AS catalog_basic,
               s.basic AS search_basic,
               h.is_basic AS derived_basic,
               c.preferred AS catalog_preferred,
               s.preferred AS search_preferred,
               h.is_preferred AS derived_preferred,
               c.is_extended_promotional AS catalog_extended,
               s.is_extended_promotional AS search_extended,
               h.is_extended_promotional AS derived_extended,
               h.description AS derived_description
             FROM component_catalog c
             JOIN search_index s ON s.lcsc = c.lcsc
             LEFT JOIN hdmi_port h ON h.lcsc = c.lcsc
             ORDER BY c.lcsc`,
          )
          .all(),
      ).toEqual([
        {
          lcsc: 1,
          catalog_stock: 11,
          search_stock: 11,
          derived_stock: 11,
          derived_in_stock: 1,
          catalog_basic: 0,
          search_basic: 0,
          derived_basic: 0,
          catalog_preferred: 1,
          search_preferred: 1,
          derived_preferred: 1,
          catalog_extended: 1,
          search_extended: 1,
          derived_extended: 1,
          derived_description: "false to true",
        },
        {
          lcsc: 2,
          catalog_stock: 22,
          search_stock: 22,
          derived_stock: 22,
          derived_in_stock: 1,
          catalog_basic: 1,
          search_basic: 1,
          derived_basic: 1,
          catalog_preferred: 1,
          search_preferred: 1,
          derived_preferred: 1,
          catalog_extended: 0,
          search_extended: 0,
          derived_extended: 0,
          derived_description: "true to false",
        },
        {
          lcsc: 3,
          catalog_stock: 33,
          search_stock: 33,
          derived_stock: 33,
          derived_in_stock: 1,
          catalog_basic: 1,
          search_basic: 1,
          derived_basic: 1,
          catalog_preferred: 0,
          search_preferred: 0,
          derived_preferred: 0,
          catalog_extended: 0,
          search_extended: 0,
          derived_extended: 0,
          derived_description: "unchanged",
        },
        {
          lcsc: 4,
          catalog_stock: 44,
          search_stock: 44,
          derived_stock: null,
          derived_in_stock: null,
          catalog_basic: 0,
          search_basic: 0,
          derived_basic: null,
          catalog_preferred: 1,
          search_preferred: 1,
          derived_preferred: null,
          catalog_extended: 1,
          search_extended: 1,
          derived_extended: null,
          derived_description: null,
        },
        {
          lcsc: 5,
          catalog_stock: 55,
          search_stock: 55,
          derived_stock: 55,
          derived_in_stock: 1,
          catalog_basic: 0,
          search_basic: 0,
          derived_basic: 0,
          catalog_preferred: 0,
          search_preferred: 0,
          derived_preferred: 0,
          catalog_extended: 0,
          search_extended: 0,
          derived_extended: 0,
          derived_description: "final short batch",
        },
        {
          lcsc: 999,
          catalog_stock: 999,
          search_stock: 999,
          derived_stock: 999,
          derived_in_stock: 1,
          catalog_basic: 1,
          search_basic: 1,
          derived_basic: 1,
          catalog_preferred: 1,
          search_preferred: 1,
          derived_preferred: 1,
          catalog_extended: null,
          search_extended: null,
          derived_extended: null,
          derived_description: "unrelated",
        },
      ])

      expect(
        proof
          .query(
            `SELECT lcsc, stock, in_stock, is_basic, is_preferred, is_extended_promotional
             FROM usb_c_connector
             ORDER BY lcsc`,
          )
          .all(),
      ).toEqual([
        {
          lcsc: 1,
          stock: 11,
          in_stock: 1,
          is_basic: 0,
          is_preferred: 1,
          is_extended_promotional: 1,
        },
        {
          lcsc: 2,
          stock: 22,
          in_stock: 1,
          is_basic: 1,
          is_preferred: 1,
          is_extended_promotional: 0,
        },
        {
          lcsc: 3,
          stock: 33,
          in_stock: 1,
          is_basic: 1,
          is_preferred: 0,
          is_extended_promotional: 0,
        },
        {
          lcsc: 5,
          stock: 55,
          in_stock: 1,
          is_basic: 0,
          is_preferred: 0,
          is_extended_promotional: 0,
        },
        {
          lcsc: 999,
          stock: 999,
          in_stock: 1,
          is_basic: 1,
          is_preferred: 1,
          is_extended_promotional: null,
        },
      ])

      const changesBeforeRetry = proof
        .query<{ changes: number }, []>("SELECT total_changes() AS changes")
        .get()?.changes
      proof.exec(
        createCombinedStockPropagationSql({
          lcscs: [1, 2],
          includeSearchIndex: true,
          derivedTableNames: ["hdmi_port", "usb_c_connector"],
        }),
      )
      const changesAfterRetry = proof
        .query<{ changes: number }, []>("SELECT total_changes() AS changes")
        .get()?.changes
      expect(changesAfterRetry).toBe(changesBeforeRetry)
    } finally {
      proof.close()
    }

    const log = await readFile(logPath, "utf8")
    const propagationStatements = log
      .split("---SQL---")
      .filter((statement) =>
        statement.includes("WITH component_updates(lcsc) AS (VALUES"),
      )
    expect(propagationStatements).toHaveLength(3)
    for (const statement of propagationStatements) {
      const values = statement.match(
        /WITH component_updates\(lcsc\) AS \(VALUES (\([^)]+\)(?:,\([^)]+\))*)\)/,
      )?.[1]
      expect(values).toBeDefined()
      expect(values?.match(/\(/g)?.length ?? 0).toBeLessThanOrEqual(2)
      expect(statement).toContain("BEGIN TRANSACTION;")
      expect(statement).toContain("UPDATE search_index AS target")
      expect(statement).toContain('UPDATE "hdmi_port" AS target')
      expect(statement).toContain('UPDATE "usb_c_connector" AS target')
      expect(statement).toContain("COMMIT;")
    }
    expect(log).toContain("WITH component_updates(lcsc) AS (VALUES (1),(2))")
    expect(log).toContain("WITH component_updates(lcsc) AS (VALUES (5))")
    expect(log).not.toContain(
      "SET stock = (SELECT source.stock FROM component_catalog",
    )
  })

  test("rejects duplicate component identifiers", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (
        lcsc INTEGER,
        stock INTEGER,
        basic INTEGER NOT NULL,
        preferred INTEGER NOT NULL,
        is_extended_promotional INTEGER NOT NULL
      );
      INSERT INTO component_stock(
        lcsc,
        stock,
        basic,
        preferred,
        is_extended_promotional
      ) VALUES
        (1, 10, 0, 1, 1),
        (1, 20, 0, 1, 1);
    `)
    source.close()

    await expect(
      writeStockSyncBatches({
        sourcePath,
        outputDirectory: path.join(directory, "batches"),
      }),
    ).rejects.toThrow("component_stock.lcsc must be unique and non-null")
  })

  test("fails closed when classification columns are missing from the snapshot", async () => {
    const directory = await createTempDirectory()
    const sourcePath = path.join(directory, "source.sqlite3")
    const source = new Database(sourcePath, { create: true })
    source.exec(`
      CREATE TABLE component_stock (lcsc INTEGER, stock INTEGER);
      INSERT INTO component_stock(lcsc, stock) VALUES (1, 10);
    `)
    source.close()

    await expect(
      writeStockSyncBatches({
        sourcePath,
        outputDirectory: path.join(directory, "batches"),
      }),
    ).rejects.toThrow(
      "component_stock is missing required columns: basic, preferred, is_extended_promotional",
    )
  })

  test("keeps 1,000-row statements below D1's query-size limit", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lcsc: 9_000_000 + index,
      stock: 999_999_999,
      basic: 0,
      preferred: 1,
      is_extended_promotional: 1,
    }))
    const statements = createStockSyncBatchSql(rows).split(";\n")
    const lcscList = createStockSyncBatchLcscList(rows)

    expect(statements).toHaveLength(1)
    for (const statement of statements) {
      expect(Buffer.byteLength(statement)).toBeLessThan(100_000)
    }
    expect(Buffer.byteLength(lcscList)).toBeLessThan(20_000)
    expect(lcscList.split("\n").filter(Boolean)).toHaveLength(1000)
  })
})
