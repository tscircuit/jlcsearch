import { afterEach } from "bun:test"
import { getDbClient } from "lib/db/get-db-client"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []
// Pass the shared client explicitly: without it setupDerivedTables destroys
// the getDbClient() singleton in its finally block, and every route test
// afterwards fails with "driver has already been destroyed"
globalThis.derivedTablesSetupPromise ??= setupDerivedTables({
  db: getDbClient(),
  populate: false,
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
