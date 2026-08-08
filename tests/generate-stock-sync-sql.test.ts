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

  test("keeps 1,000-row statements below D1's query-size limit", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lcsc: 9_000_000 + index,
      stock: 999_999_999,
    }))
    const statements = createStockSyncBatchSql(rows).split(";\n")

    expect(statements).toHaveLength(2)
    for (const statement of statements) {
      expect(Buffer.byteLength(statement)).toBeLessThan(100_000)
    }
  })
})
