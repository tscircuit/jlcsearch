import { platform } from "node:os"
import { join } from "node:path"

const binaryName = platform() === "win32" ? "7za.exe" : "7zz"
const binaryPath = join(".bin", binaryName)

const process = Bun.spawn([binaryPath, "x", ".buildtmp/cache.zip", "-y"], {
  stdout: "inherit",
  stderr: "inherit",
})

const exitCode = await process.exited
if (exitCode !== 0) {
  throw new Error(`7-Zip extraction failed with exit code ${exitCode}`)
}
