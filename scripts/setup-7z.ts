import { mkdir, chmod } from "node:fs/promises"
import { existsSync } from "node:fs"
import { platform, arch } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"

// Map of platform-arch combinations to download URLs
const BINARY_URLS: Record<string, string> = {
  "linux-x64": "https://7-zip.org/a/7z2408-linux-x64.tar.xz",
  "linux-arm64": "https://7-zip.org/a/7z2408-linux-arm64.tar.xz",
  "darwin-x64": "https://7-zip.org/a/7z2408-mac.tar.xz",
  "darwin-arm64": "https://7-zip.org/a/7z2408-mac.tar.xz",
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
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`)
  }

  // Save the tar.xz file
  const tempFile = "7z-temp.tar.xz"
  await Bun.write(tempFile, await response.arrayBuffer())

  // Extract the tar.xz file
  console.log("Extracting 7z binary...")
  await Bun.spawn(["tar", "xf", tempFile]).exited

  // Move the binary to the right location
  await Bun.spawn(["mv", "7zz", binaryPath]).exited

  // Make the binary executable
  await chmod(binaryPath, 0o755)

  // Cleanup
  await Bun.spawn(["rm", tempFile]).exited

  console.log("7z binary setup complete")
}

await downloadAndExtract7z()
