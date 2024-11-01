import type { Middleware } from "winterspec/middleware"
import { getDbClient } from "lib/db/get-db-client"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

export const withDb: Middleware<
  {},
  {
    db: KyselyDatabaseInstance
  }
> = (req, ctx, next) => {
  if (!ctx.db) {
    ctx.db = getDbClient()
  }
  return next(req, ctx)
}
