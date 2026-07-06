import type { Database as BunDatabase } from "bun:sqlite"
import Path from "node:path"
import type { Kysely } from "kysely"
import type { BunSqliteDialect } from "kysely-bun-sqlite"
import type { DB } from "./generated/kysely"

let DatabaseCtor: typeof BunDatabase | undefined
let databaseImportError: unknown

let KyselyCtor: typeof Kysely | undefined
let kyselyImportError: unknown

let BunSqliteDialectCtor: typeof BunSqliteDialect | undefined
let bunSqliteImportError: unknown

let dbClientSingleton: Kysely<DB> | undefined
let dbClientSingletonPath: string | undefined

if (process.env.WINTERSPEC_CODEGEN !== "true") {
  try {
    const sqliteModule = await import("bun:sqlite")
    DatabaseCtor = sqliteModule.Database
  } catch (err) {
    databaseImportError = err
  }

  try {
    const kyselyModule = await import("kysely")
    KyselyCtor = kyselyModule.Kysely
  } catch (err) {
    kyselyImportError = err
  }

  try {
    const bunSqliteModule = await import("kysely-bun-sqlite")
    BunSqliteDialectCtor = bunSqliteModule.BunSqliteDialect
  } catch (err) {
    bunSqliteImportError = err
  }
}

const getDatabaseCtor = (): typeof BunDatabase => {
  if (!DatabaseCtor) {
    throw databaseImportError instanceof Error
      ? databaseImportError
      : new Error("bun:sqlite is not available in this environment")
  }
  return DatabaseCtor
}

const DEFAULT_DB_PATH = Path.join(import.meta.dir, "../../db.sqlite3")

export const getResolvedDbPath = (): string => {
  const configuredPath = process.env.JLCSEARCH_DB_PATH?.trim()
  if (!configuredPath) return DEFAULT_DB_PATH
  return Path.isAbsolute(configuredPath)
    ? configuredPath
    : Path.resolve(process.cwd(), configuredPath)
}

export const getDbClient = () => {
  const dbPath = getResolvedDbPath()
  if (dbClientSingleton) {
    if (dbClientSingletonPath === dbPath) return dbClientSingleton

    const staleDb = dbClientSingleton
    dbClientSingleton = undefined
    dbClientSingletonPath = undefined
    void staleDb.destroy()
  }

  const Database = getDatabaseCtor()
  const KyselyCtorRef = KyselyCtor
  const BunSqliteDialectRef = BunSqliteDialectCtor

  if (!KyselyCtorRef || !BunSqliteDialectRef) {
    throw (
      kyselyImportError ||
      bunSqliteImportError ||
      new Error("Database dependencies are not available in this environment")
    )
  }

  dbClientSingleton = new KyselyCtorRef<DB>({
    dialect: new BunSqliteDialectRef({
      database: new Database(dbPath),
    }),
  })
  dbClientSingletonPath = dbPath

  return dbClientSingleton
}

export const destroyDbClient = async () => {
  if (!dbClientSingleton) return

  const activeDb = dbClientSingleton
  dbClientSingleton = undefined
  dbClientSingletonPath = undefined
  await activeDb.destroy()
}

export const getBunDatabaseClient = () => {
  const Database = getDatabaseCtor()
  return new Database(getResolvedDbPath())
}
