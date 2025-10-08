import { afterEach } from "bun:test"

declare global {
  var deferredCleanupFns: Array<() => void | Promise<void>>
}

globalThis.deferredCleanupFns ??= []

afterEach(async () => {
  const cleanupFns = [...globalThis.deferredCleanupFns]
  globalThis.deferredCleanupFns.length = 0

  for (let index = cleanupFns.length - 1; index >= 0; index -= 1) {
    const cleanup = cleanupFns[index]
    await cleanup()
  }
})

export {}
