import { Database } from "bun:sqlite"
import { Kysely, SqliteDialect } from "kysely"
import Path from "node:path"
import type { DB } from "./generated/kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { SqliteDialect } from "kysely"

export const getDbClient = () => {
  return new Kysely<DB>({
    dialect: new BunSqliteDialect({
      database: getBunDatabaseClient(),
    }),
  })
}

export const getBunDatabaseClient = () => {
  return new Database(Path.join(import.meta.dir, "../../db.sqlite3"))
}
