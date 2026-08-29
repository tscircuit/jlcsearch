import { existsSync } from "node:fs"
import { platform } from "node:os"

// Portable replacement for the old `.bin/7zz x .buildtmp/cache.zip` shell
// script: resolves the .exe suffix on Windows so setup works everywhere.
const binary = platform() === "win32" ? ".bin/7zz.exe" : ".bin/7zz"

if (!existsSync(binary)) {
  console.error(`${binary} not found - run 'bun run setup:7z' first`)
  process.exit(1)
}

const proc = Bun.spawn([binary, "x", ".buildtmp/cache.zip", "-o.buildtmp"], {
  stdout: "inherit",
  stderr: "inherit",
})
const exitCode = await proc.exited
if (exitCode !== 0) {
  console.error(`7zz extraction failed with exit code ${exitCode}`)
  process.exit(exitCode)
}
