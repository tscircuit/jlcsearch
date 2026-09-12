import { Kysely, SqliteDialect } from "kysely"
import { Database } from "./schema"

let db: Kysely<Database> | null = null

export const getDb = (opts?: { file?: string }) => {
  if (db) return db

  // Dynamic import to avoid issues in non-Node environments
  const Database = require("better-sqlite3")
  const dbFile = opts?.file ?? process.env.JLCSEARCH_DATA_DIR
    ? `${process.env.JLCSEARCH_DATA_DIR}/jlcsearch.db`
    : "./jlcsearch.db"

  const sqliteDb = new Database(dbFile)

  // Ensure is_extended_promotional column exists (migration)
  try {
    sqliteDb
      .prepare(
        `ALTER TABLE components ADD COLUMN is_extended_promotional INTEGER NOT NULL DEFAULT 0`
      )
      .run()
  } catch (e: any) {
    // Column already exists — that's fine
    if (!e.message?.includes("duplicate column name")) {
      // ignore other errors during migration attempt
    }
  }

  db = new Kysely<Database>({
    dialect: new SqliteDialect({
      database: sqliteDb,
    }),
  })

  return db
}
