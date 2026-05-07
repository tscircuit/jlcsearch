import { afterEach } from "bun:test"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { setupTestTables } from "lib/db/setup-test-tables"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []
globalThis.derivedTablesSetupPromise ??= Promise.all([
  setupDerivedTables({ populate: false }),
  setupTestTables(),
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
