import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import Path from "node:path"
import { destroyDbClient } from "lib/db/get-db-client"
import { getTestServer } from "tests/fixtures/get-test-server"

let tempDir: string | undefined
const previousDbPath = process.env.JLCSEARCH_DB_PATH

const seedComponentDatabase = async () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-promotional-"))
  const dbPath = Path.join(tempDir, "db.sqlite3")
  const db = new Database(dbPath)

  db.exec(`
    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY,
      mfr TEXT,
      package TEXT,
      description TEXT,
      stock INTEGER,
      price TEXT,
      extra TEXT,
      basic INTEGER,
      preferred INTEGER,
      category_id INTEGER,
      datasheet TEXT,
      flag INTEGER,
      joints INTEGER,
      last_on_stock INTEGER,
      last_update INTEGER,
      manufacturer_id INTEGER
    );

    CREATE VIEW v_components AS
      SELECT
        lcsc,
        mfr,
        package,
        description,
        stock,
        price,
        extra,
        basic,
        preferred,
        category_id,
        NULL AS category,
        NULL AS subcategory,
        mfr AS manufacturer,
        datasheet,
        joints,
        last_on_stock
      FROM components;

    INSERT INTO components (
      lcsc,
      mfr,
      package,
      description,
      stock,
      price,
      extra,
      basic,
      preferred,
      category_id,
      datasheet,
      flag,
      joints,
      last_on_stock,
      last_update,
      manufacturer_id
    ) VALUES
      (1001, 'EXT-PROMO', '0603', 'extended promotional part', 50, '[{"price":"0.01"}]', '{}', 0, 1, 1, '', 0, 0, 0, 0, 1),
      (1002, 'BASIC-PREFERRED', '0603', 'basic preferred part', 40, '[{"price":"0.02"}]', '{}', 1, 1, 1, '', 0, 0, 0, 0, 1),
      (1003, 'REGULAR', '0603', 'regular part', 30, '[{"price":"0.03"}]', '{}', 0, 0, 1, '', 0, 0, 0, 0, 1);
  `)
  db.close()

  process.env.JLCSEARCH_DB_PATH = dbPath
  await destroyDbClient()
}

afterEach(async () => {
  await destroyDbClient()

  if (previousDbPath === undefined) {
    delete process.env.JLCSEARCH_DB_PATH
  } else {
    process.env.JLCSEARCH_DB_PATH = previousDbPath
  }

  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true, maxRetries: 3 })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EBUSY") {
        throw err
      }
    }
    tempDir = undefined
  }
})

test("GET /api/search exposes and filters extended promotional components", async () => {
  await seedComponentDatabase()
  const { axios, server } = await getTestServer()

  try {
    const allResponse = await axios.get("/api/search?limit=10")
    expect(allResponse.data.components).toContainEqual(
      expect.objectContaining({
        lcsc: 1001,
        is_basic: false,
        is_preferred: true,
        is_extended_promotional: true,
      }),
    )
    expect(allResponse.data.components).toContainEqual(
      expect.objectContaining({
        lcsc: 1002,
        is_basic: true,
        is_preferred: true,
        is_extended_promotional: false,
      }),
    )

    const filteredResponse = await axios.get(
      "/api/search?limit=10&is_extended_promotional=true",
    )
    expect(filteredResponse.data.components).toHaveLength(1)
    expect(filteredResponse.data.components[0]).toMatchObject({
      lcsc: 1001,
      is_extended_promotional: true,
    })
  } finally {
    await server.stop()
  }
})

test("GET /components/list exposes and filters extended promotional components", async () => {
  await seedComponentDatabase()
  const { axios, server } = await getTestServer()

  try {
    const response = await axios.get(
      "/components/list?json=true&is_extended_promotional=true",
    )

    expect(response.data.components).toHaveLength(1)
    expect(response.data.components[0]).toMatchObject({
      lcsc: 1001,
      is_basic: false,
      is_preferred: true,
      is_extended_promotional: true,
    })
  } finally {
    await server.stop()
  }
})
