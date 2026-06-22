import { existsSync } from "node:fs"
import { chmod, mkdir } from "node:fs/promises"
import { arch, platform } from "node:os"

const BINARY_DIR = ".bin"
const BINARY_NAME = "7zz"
const GITHUB_RELEASE_API =
  "https://api.github.com/repos/ip7z/7zip/releases/latest"

// Map of platform-arch combinations to release asset suffixes.
const ASSET_SUFFIXES: Record<string, string> = {
  "linux-x64": "linux-x64.tar.xz",
  "linux-arm64": "linux-arm64.tar.xz",
  "darwin-x64": "mac.tar.xz",
  "darwin-arm64": "mac.tar.xz",
}

const FALLBACK_DOWNLOAD_URLS: Record<string, string> = {
  "linux-x64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-linux-x64.tar.xz",
  "linux-arm64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-linux-arm64.tar.xz",
  "darwin-x64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-mac.tar.xz",
  "darwin-arm64":
    "https://github.com/ip7z/7zip/releases/download/26.01/7z2601-mac.tar.xz",
}

type GithubReleaseAsset = {
  name: string
  browser_download_url: string
}

async function resolveDownloadUrl(platformKey: string) {
  const assetSuffix = ASSET_SUFFIXES[platformKey]
  if (!assetSuffix) {
    throw new Error(`Unsupported platform: ${platformKey}`)
  }

  const response = await fetch(GITHUB_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "jlcsearch-setup-7z",
    },
  })

  if (!response.ok) {
    const fallbackUrl = FALLBACK_DOWNLOAD_URLS[platformKey]
    if (fallbackUrl) {
      console.warn(
        `Failed to load latest 7-Zip release: ${response.status} ${response.statusText}; using pinned fallback`,
      )
      return fallbackUrl
    }

    throw new Error(
      `Failed to load latest 7-Zip release: ${response.status} ${response.statusText}`,
    )
  }

  const release = (await response.json()) as {
    tag_name?: string
    assets?: GithubReleaseAsset[]
  }
  const assets = release.assets ?? []
  const asset = assets.find((candidate) => candidate.name.endsWith(assetSuffix))

  if (!asset) {
    const availableAssets = assets.map((candidate) => candidate.name).join(", ")
    throw new Error(
      `Could not find 7-Zip asset ending with "${assetSuffix}" in latest release ${release.tag_name ?? "unknown"}; available assets: ${availableAssets}`,
    )
  }

  return asset.browser_download_url
}

async function downloadAndExtract7z() {
  const currentPlatform = platform()
  const currentArch = arch()
  const platformKey = `${currentPlatform}-${currentArch}`

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

  const downloadUrl = await resolveDownloadUrl(platformKey)
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
