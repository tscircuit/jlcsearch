import type { Middleware } from "winterspec/middleware"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

let getDbClientFn: (() => KyselyDatabaseInstance) | undefined

const loadDbClient = async (): Promise<KyselyDatabaseInstance> => {
  if (!getDbClientFn) {
    const module = await import("lib/db/get-db-client")
    getDbClientFn = module.getDbClient
  }
  return getDbClientFn()
}

export const withDb: Middleware<
  {},
  {
    db: KyselyDatabaseInstance
  }
> = async (req, ctx, next) => {
  if (!ctx.db) {
    try {
      ctx.db = await loadDbClient()
    } catch (err) {
      if (process.env.WINTERSPEC_CODEGEN === "true") {
        return next(req, ctx)
      }
      throw err
    }
  }
  return next(req, ctx)
}
