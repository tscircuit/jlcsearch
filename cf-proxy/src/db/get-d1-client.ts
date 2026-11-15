import { Kysely } from "kysely"
import { D1Dialect } from "kysely-d1"
import type { DB } from "./types"
import { createD1QueryLogger } from "../d1-observability"

export function getD1Client(d1: D1Database, route = "unknown"): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new D1Dialect({ database: d1 }),
    log: createD1QueryLogger(route),
  })
}
