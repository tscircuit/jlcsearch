import { mkdir, chmod, rename, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { platform, arch } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"

// Map of platform-arch combinations to download URLs
const BINARY_URLS: Record<string, string> = {
  "linux-x64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-linux-x64.tar.xz",
  "linux-arm64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-linux-arm64.tar.xz",
  "darwin-x64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-mac.tar.xz",
  "darwin-arm64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-mac.tar.xz",
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
  const tempFile = `${BINARY_DIR}/7z-temp.tar.xz`
  await Bun.write(tempFile, await response.arrayBuffer())

  // Extract only the executable instead of unpacking docs into the repo root.
  console.log("Extracting 7z binary...")
  const extractExitCode = await Bun.spawn(["tar", "xf", tempFile, BINARY_NAME])
    .exited
  if (extractExitCode !== 0) {
    throw new Error(`Failed to extract ${BINARY_NAME}`)
  }

  // Move the binary to the right location
  await rename(BINARY_NAME, binaryPath)

  // Make the binary executable
  await chmod(binaryPath, 0o755)

  // Cleanup
  await rm(tempFile, { force: true })

  console.log("7z binary setup complete")
}

await downloadAndExtract7z()
