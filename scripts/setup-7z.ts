import { mkdir, chmod, rename, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { platform, arch } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"
const EXTRACT_DIR = ".buildtmp/7z"

// Map of platform-arch combinations to download URLs
const BINARY_URLS: Record<string, string> = {
  "linux-x64": "https://7-zip.org/a/7z2600-linux-x64.tar.xz",
  "linux-arm64": "https://7-zip.org/a/7z2600-linux-arm64.tar.xz",
  "darwin-x64": "https://7-zip.org/a/7z2600-mac.tar.xz",
  "darwin-arm64": "https://7-zip.org/a/7z2600-mac.tar.xz",
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

  await rm(EXTRACT_DIR, { recursive: true, force: true })
  await mkdir(EXTRACT_DIR, { recursive: true })
  const tempFile = `${EXTRACT_DIR}/7z-temp.tar.xz`
  await Bun.write(tempFile, await response.arrayBuffer())

  console.log("Extracting 7z binary...")
  await Bun.spawn(["tar", "xf", tempFile, "-C", EXTRACT_DIR]).exited

  await rename(`${EXTRACT_DIR}/${BINARY_NAME}`, binaryPath)
  await chmod(binaryPath, 0o755)
  await rm(EXTRACT_DIR, { recursive: true, force: true })

  console.log("7z binary setup complete")
}

await downloadAndExtract7z()
