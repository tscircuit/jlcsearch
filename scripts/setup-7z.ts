import { mkdir, chmod } from "node:fs/promises"
import { existsSync } from "node:fs"
import { platform, arch } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"
const SEVEN_ZIP_VERSION = "2601"

// Map of platform-arch combinations to download URLs
const BINARY_URLS: Record<string, string> = {
  "linux-x64": `https://7-zip.org/a/7z${SEVEN_ZIP_VERSION}-linux-x64.tar.xz`,
  "linux-arm64": `https://7-zip.org/a/7z${SEVEN_ZIP_VERSION}-linux-arm64.tar.xz`,
  "darwin-x64": `https://7-zip.org/a/7z${SEVEN_ZIP_VERSION}-mac.tar.xz`,
  "darwin-arm64": `https://7-zip.org/a/7z${SEVEN_ZIP_VERSION}-mac.tar.xz`,
}

async function runCommand(command: string[]) {
  const exitCode = await Bun.spawn(command).exited
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`)
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
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to download ${downloadUrl}: ${response.status} ${response.statusText}`,
    )
  }

  // Save the tar.xz file
  const tempFile = "7z-temp.tar.xz"
  await Bun.write(tempFile, await response.arrayBuffer())

  // Extract the tar.xz file
  console.log("Extracting 7z binary...")
  await runCommand(["tar", "xf", tempFile])

  // Move the binary to the right location
  await runCommand(["mv", "7zz", binaryPath])

  // Make the binary executable
  await chmod(binaryPath, 0o755)

  // Cleanup
  await runCommand(["rm", tempFile])

  console.log("7z binary setup complete")
}

await downloadAndExtract7z()
