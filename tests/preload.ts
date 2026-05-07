import { afterEach } from "bun:test"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { setupTestTables } from "lib/db/setup-test-tables"
import { getDbClient } from "lib/db/get-db-client"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []
// Pass the singleton explicitly so setupDerivedTables doesn't destroy it
const sharedDb = getDbClient()
globalThis.derivedTablesSetupPromise ??= Promise.all([
  setupDerivedTables({ populate: false, db: sharedDb }),
  setupTestTables(sharedDb),
]).then(() => undefined)

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
