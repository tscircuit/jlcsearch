import { existsSync } from "node:fs"
import { chmod, mkdir } from "node:fs/promises"
import { arch, platform } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"

// Map of platform-arch combinations to download URLs
const BINARY_URLS: Record<string, string> = {
  "linux-x64": "https://7-zip.org/a/7z2601-linux-x64.tar.xz",
  "linux-arm64": "https://7-zip.org/a/7z2601-linux-arm64.tar.xz",
  "darwin-x64": "https://7-zip.org/a/7z2601-mac.tar.xz",
  "darwin-arm64": "https://7-zip.org/a/7z2601-mac.tar.xz",
}

async function runCommand(command: string[]) {
  const proc = Bun.spawn(command)
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(" ")}`)
  }
}

async function downloadAndExtract7z() {
  const currentPlatform = platform()
  const currentArch = arch()
  const platformKey = `${currentPlatform}-${currentArch}`

  const downloadUrl = BINARY_URLS[platformKey]
  if (!downloadUrl) {
    throw new Error(`Unsupported platform: ${platformKey}`)
  }

  // Create binary directory if it doesn't exist
  if (!existsSync(BINARY_DIR)) {
    await mkdir(BINARY_DIR)
  }

  const binaryPath = `${BINARY_DIR}/${BINARY_NAME}`

  // Skip if binary already exists
  if (existsSync(binaryPath)) {
    console.log("7z binary already exists")
    return
  }

  console.log("Downloading 7z...")
  // Save the tar.xz file
  const tempFile = "7z-temp.tar.xz"
  await runCommand([
    "curl",
    "-fL",
    "--retry",
    "3",
    "--retry-delay",
    "2",
    "-o",
    tempFile,
    downloadUrl,
  ])

  // Extract the tar.xz file
  console.log("Extracting 7z binary...")
  await runCommand(["tar", "xf", tempFile, BINARY_NAME])

  // Move the binary to the right location
  await runCommand(["mv", "7zz", binaryPath])

  // Make the binary executable
  await chmod(binaryPath, 0o755)

  // Cleanup
  await runCommand(["rm", tempFile])

  console.log("7z binary setup complete")
}

await downloadAndExtract7z()
