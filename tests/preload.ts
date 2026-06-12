import { afterEach } from "bun:test"
import { getDbClient } from "lib/db/get-db-client"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { closeSync, existsSync, openSync, unlinkSync } from "node:fs"
import Path from "node:path"
import { tmpdir } from "node:os"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
  var derivedTablesSetupPromise: Promise<void> | undefined
}

globalThis.deferredCleanupFns ??= []

const initLockPath = Path.join(tmpdir(), "jlcsearch-derived-tables.lock")

const acquireInitLock = () => {
  while (true) {
    try {
      const fd = openSync(initLockPath, "wx")
      return fd
    } catch {
      if (!existsSync(initLockPath)) continue
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
  }
}

const releaseInitLock = (fd: number) => {
  try {
    unlinkSync(initLockPath)
  } catch {
    // no-op
  }
  try {
    closeSync(fd)
  } catch {
    // no-op
  }
}

const initLockFd = acquireInitLock()
try {
  globalThis.derivedTablesSetupPromise ??= setupDerivedTables({
    db: getDbClient(),
    populate: false,
  })
  await globalThis.derivedTablesSetupPromise
} finally {
  releaseInitLock(initLockFd)
}

afterEach(async () => {
  const cleanupFns = [...globalThis.deferredCleanupFns]
  globalThis.deferredCleanupFns.length = 0

  for (let index = cleanupFns.length - 1; index >= 0; index -= 1) {
    const cleanup = cleanupFns[index]
    await cleanup()
  }
})

export {}
