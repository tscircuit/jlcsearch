import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import Path from "node:path"
import { componentExtendedPromotionalColumn } from "lib/db/optimizations/component-extended-promotional-column"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

let tempDir: string | undefined
let openDb: KyselyDatabaseInstance | undefined
let openSqlite: Database | undefined

afterEach(async () => {
  if (openDb) {
    await openDb.destroy()
    openDb = undefined
  }
  if (openSqlite) {
    openSqlite.close()
    openSqlite = undefined
  }
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup: Windows can keep sqlite files briefly locked
    }
    tempDir = undefined
  }
})

const createFixtureDb = () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-ext-promo-"))
  const dbPath = Path.join(tempDir, "db.sqlite3")

  const seedDb = new Database(dbPath)
  seedDb.exec(`
    CREATE TABLE components (
      lcsc INTEGER PRIMARY KEY,
      mfr TEXT,
      basic INTEGER,
      preferred INTEGER,
      stock INTEGER
    );
    INSERT INTO components (lcsc, mfr, basic, preferred, stock) VALUES
      (1, 'basic_part', 1, 0, 100),
      (2, 'extended_promotional_part', 0, 1, 100),
      (3, 'regular_extended_part', 0, 0, 100);
  `)
  seedDb.close()

  openSqlite = new Database(dbPath)
  const db = new Kysely({
    dialect: new BunSqliteDialect({ database: openSqlite }),
  }) as unknown as KyselyDatabaseInstance
  openDb = db

  return db
}

test("is_extended_promotional column derives from preferred and basic", async () => {
  const db = createFixtureDb()

  expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(false)

  await componentExtendedPromotionalColumn.execute(db)

  expect(await componentExtendedPromotionalColumn.checkIfAdded(db)).toBe(true)

  const rows = (await db
    .selectFrom("components" as any)
    .select(["mfr" as any, "is_extended_promotional" as any])
    .orderBy("lcsc" as any)
    .execute()) as Array<{ mfr: string; is_extended_promotional: number }>

  expect(rows.map((r) => Boolean(r.is_extended_promotional))).toEqual([
    false, // basic part
    true, // preferred extended part acting as basic
    false, // regular extended part
  ])
})
