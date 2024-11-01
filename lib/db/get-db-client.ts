import { Kysely, SqliteDialect } from "kysely"
import { Database } from "bun:sqlite"

export const getDbClient = () => {
  return new Kysely<Database>({
    dialect: new SqliteDialect({
      database: async () => new Database("./db.sqlite3") as any,
    }),
  })
}
