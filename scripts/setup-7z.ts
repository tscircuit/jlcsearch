import { existsSync } from "node:fs"
import { chmod, mkdir, rename, rm } from "node:fs/promises"
import { arch, platform } from "node:os"

const BINARY_DIR = ".bin"
const IS_WINDOWS = platform() === "win32"
const BINARY_NAME = IS_WINDOWS ? "7zz.exe" : "7zz"
const SEVEN_ZIP_VERSION = "26.02"
const SEVEN_ZIP_ARCHIVE_VERSION = SEVEN_ZIP_VERSION.replace(".", "")
const RELEASE_BASE_URL = `https://github.com/ip7z/7zip/releases/download/${SEVEN_ZIP_VERSION}`

// Map of platform-arch combinations to download URLs. Windows ships as a zip
// rather than tar.xz; Windows 10+ bundles bsdtar, which extracts both.
const BINARY_URLS: Record<string, string> = {
  "linux-x64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-linux-x64.tar.xz`,
  "linux-arm64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-linux-arm64.tar.xz`,
  "darwin-x64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-mac.tar.xz`,
  "darwin-arm64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-mac.tar.xz`,
  "win32-x64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-win-x64.zip`,
  "win32-arm64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-win-arm64.zip`,
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

  // Save the archive (tar.xz on unix, zip on Windows)
  const tempFile = IS_WINDOWS ? "7z-temp.zip" : "7z-temp.tar.xz"
  await Bun.write(tempFile, await response.arrayBuffer())

  // Extract it. Windows 10+ bundles bsdtar, which handles zip as well as
  // tar.xz, so `tar xf` works everywhere without PowerShell dances.
  console.log("Extracting 7z binary...")
  await Bun.spawn(["tar", "xf", tempFile]).exited

  // Move the binary to the right location using fs APIs so Windows (no
  // `mv`/`rm`) behaves exactly like unix.
  const extractedName = IS_WINDOWS ? "7zz.exe" : "7zz"
  await rename(extractedName, binaryPath)

  // Make the binary executable (no-op on Windows)
  if (!IS_WINDOWS) {
    await chmod(binaryPath, 0o755)
  }

  // Cleanup
  await rm(tempFile, { force: true })

  console.log("7z binary setup complete")
}

await downloadAndExtract7z()
