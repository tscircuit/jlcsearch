import { mkdir, chmod } from "node:fs/promises"
import { existsSync } from "node:fs"
import { platform, arch } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"
const RELEASE_API_URL = "https://api.github.com/repos/ip7z/7zip/releases/latest"
const PLATFORM_ASSET_SUFFIXES: Record<string, string> = {
  "linux-x64": "linux-x64.tar.xz",
  "linux-arm64": "linux-arm64.tar.xz",
  "darwin-x64": "mac.tar.xz",
  "darwin-arm64": "mac.tar.xz",
}

async function downloadAndExtract7z() {
  const currentPlatform = platform()
  const currentArch = arch()
  const platformKey = `${currentPlatform}-${currentArch}`

  const assetSuffix = PLATFORM_ASSET_SUFFIXES[platformKey]
  if (!assetSuffix) {
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

  console.log("Resolving latest 7z release...")
  const releaseResponse = await fetch(RELEASE_API_URL, {
    headers: { "User-Agent": "jlcsearch-setup" },
  })
  if (!releaseResponse.ok) {
    throw new Error(
      `Failed to resolve latest 7z release: ${releaseResponse.statusText}`,
    )
  }

  const release = await releaseResponse.json()
  const asset = release.assets?.find(
    (candidate: { name?: string; browser_download_url?: string }) =>
      candidate.name?.endsWith(assetSuffix),
  )
  const downloadUrl = asset?.browser_download_url
  if (!downloadUrl) {
    throw new Error(
      `Failed to find 7z asset for ${platformKey}. Available assets: ${
        release.assets
          ?.map((candidate: { name?: string }) => candidate.name)
          .filter(Boolean)
          .join(", ") ?? "none"
      }`,
    )
  }

  console.log(`Downloading 7z from ${downloadUrl}...`)
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
