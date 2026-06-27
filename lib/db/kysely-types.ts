import type { Kysely } from "kysely"
import type { DB } from "./generated/kysely"

export type KyselyDatabaseInstance = Kysely<DB>
