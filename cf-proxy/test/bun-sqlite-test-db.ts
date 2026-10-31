/// <reference types="bun-types/sqlite" />
import type { Database } from "bun:sqlite"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "../src/db/types"

// Resolve the client and dialect from the Worker package, like the search code.
export function createSearchTestDb(sqlite: Database, statements: string[]) {
  return new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
    log(event) {
      if (event.level === "query") statements.push(event.query.sql)
    },
  })
}
