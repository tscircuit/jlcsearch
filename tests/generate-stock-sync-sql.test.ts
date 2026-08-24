import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  createStockSyncBatchSql,
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
  test("updates stock and classification in existing catalog and search rows", async () => {
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
        is_extended_promotional INTEGER,
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
        is_extended_promotional,
        description
      ) VALUES
        (1, 1, 0, 0, 0, 'changes classification'),
        (2, NULL, 1, 1, 0, 'already identical'),
        (3, 3, 1, 1, 0, 'changes stock and classification'),
        (99, 99, 1, 0, 0, 'unrelated row');
    `)

    const batchFiles = (await readdir(outputDirectory)).sort()
    for (const batchFile of batchFiles) {
      target.exec(await readFile(path.join(outputDirectory, batchFile), "utf8"))
    }

    for (const table of ["component_catalog", "search_index"]) {
      expect(
        target
          .query(
            `SELECT lcsc, stock, basic, preferred, is_extended_promotional, description
             FROM ${table}
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
    }

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

    expect(statements).toHaveLength(2)
    for (const statement of statements) {
      expect(Buffer.byteLength(statement)).toBeLessThan(100_000)
    }
  })
})
