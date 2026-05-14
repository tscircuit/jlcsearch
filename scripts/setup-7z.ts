import { mkdir, chmod } from "node:fs/promises"
import { existsSync } from "node:fs"
import { platform, arch } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"

// Map of platform-arch combinations to candidate download URLs (newest first)
const BINARY_URLS: Record<string, string[]> = {
  "linux-x64": [
    "https://7-zip.org/a/7z2501-linux-x64.tar.xz",
    "https://7-zip.org/a/7z2408-linux-x64.tar.xz",
  ],
  "linux-arm64": [
    "https://7-zip.org/a/7z2501-linux-arm64.tar.xz",
    "https://7-zip.org/a/7z2408-linux-arm64.tar.xz",
  ],
  "darwin-x64": [
    "https://7-zip.org/a/7z2501-mac.tar.xz",
    "https://7-zip.org/a/7z2408-mac.tar.xz",
  ],
  "darwin-arm64": [
    "https://7-zip.org/a/7z2501-mac.tar.xz",
    "https://7-zip.org/a/7z2408-mac.tar.xz",
  ],
}

const downloadFromCandidates = async (urls: string[]) => {
  let lastError: Error | undefined
  for (const url of urls) {
    try {
      console.log(`Trying 7z download URL: ${url}`)
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to download from ${url}: ${response.statusText}`)
      }
      return await response.arrayBuffer()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw (
    lastError ?? new Error("Failed to download 7z from all candidate URLs")
  )
}

async function downloadAndExtract7z() {
  const currentPlatform = platform()
  const currentArch = arch()
  const platformKey = `${currentPlatform}-${currentArch}`

  const downloadUrls = BINARY_URLS[platformKey]
  if (!downloadUrls) {
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
  const archiveBuffer = await downloadFromCandidates(downloadUrls)

  // Save the tar.xz file
  const tempFile = "7z-temp.tar.xz"
  await Bun.write(tempFile, archiveBuffer)

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
