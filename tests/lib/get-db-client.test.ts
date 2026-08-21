import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { sql } from "kysely";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import Path from "node:path";
import {
  destroyDbClient,
  getBunDatabaseClient,
  getDbClient,
  getResolvedDbPath,
} from "lib/db/get-db-client";

let tempDir: string | undefined;
let previousDbPath = process.env.JLCSEARCH_DB_PATH;

afterEach(() => {
  if (previousDbPath === undefined) {
    delete process.env.JLCSEARCH_DB_PATH;
  } else {
    process.env.JLCSEARCH_DB_PATH = previousDbPath;
  }

  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

test("getBunDatabaseClient respects JLCSEARCH_DB_PATH", () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-db-"));
  const dbPath = Path.join(tempDir, "custom.sqlite3");

  const seedDb = new Database(dbPath);
  seedDb.exec(`
    CREATE TABLE probe (value TEXT);
    INSERT INTO probe (value) VALUES ('ok');
  `);
  seedDb.close();

  previousDbPath = process.env.JLCSEARCH_DB_PATH;
  process.env.JLCSEARCH_DB_PATH = dbPath;

  expect(getResolvedDbPath()).toBe(dbPath);

  const db = getBunDatabaseClient();
  const row = db.query("SELECT value FROM probe").get() as {
    value: string;
  } | null;

  expect(row?.value).toBe("ok");
  db.close();
});

test("destroyDbClient clears the singleton before it is reused", async () => {
  tempDir = mkdtempSync(Path.join(tmpdir(), "jlcsearch-kysely-"));
  const dbPath = Path.join(tempDir, "custom.sqlite3");

  previousDbPath = process.env.JLCSEARCH_DB_PATH;
  await destroyDbClient();
  process.env.JLCSEARCH_DB_PATH = dbPath;

  const firstClient = getDbClient();
  await sql`SELECT 1`.execute(firstClient);
  await destroyDbClient();

  const secondClient = getDbClient();
  expect(secondClient).not.toBe(firstClient);
  await sql`SELECT 1`.execute(secondClient);
  await destroyDbClient();
});
