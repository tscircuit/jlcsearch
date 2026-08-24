import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createStockSyncBatchSql,
  writeStockSyncBatches,
} from "../scripts/generate-stock-sync-sql"
import {
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

    const batchFiles = (await readdir(outputDirectory)).sort()
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
    target.exec(createSearchIndexPropagationSql())
    target.exec(createDerivedTablePropagationSql("hdmi_port"))

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
        search_extended: 0,
        derived_extended: 0,
      },
    ])

    const changesBeforeRetry = target
      .query<{ changes: number }, []>("SELECT total_changes() AS changes")
      .get()?.changes
    target.exec(createSearchIndexPropagationSql())
    target.exec(createDerivedTablePropagationSql("hdmi_port"))
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

    expect(statements).toHaveLength(1)
    for (const statement of statements) {
      expect(Buffer.byteLength(statement)).toBeLessThan(100_000)
    }
  })
})
