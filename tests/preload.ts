import { afterEach } from "bun:test"
import { getDbClient } from "lib/db/get-db-client"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []
// Pass the shared db client explicitly so setupDerivedTables does not destroy
// the singleton after creating the derived-table schema (it only destroys when
// no `db` argument is provided).
globalThis.derivedTablesSetupPromise ??= setupDerivedTables({
  populate: false,
  db: getDbClient(),
})

await globalThis.derivedTablesSetupPromise

afterEach(async () => {
  const cleanupFns = [...globalThis.deferredCleanupFns]
  globalThis.deferredCleanupFns.length = 0

  for (let index = cleanupFns.length - 1; index >= 0; index -= 1) {
    const cleanup = cleanupFns[index]
    await cleanup()
  }
})

export {}
