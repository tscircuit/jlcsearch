import { mkdir, chmod } from "node:fs/promises"
  import { existsSync } from "node:fs"
  import { platform, arch } from "node:os"

  const BINARY_DIR = ".bin"
  const BINARY_NAME = "7zz"

  // Using 7z2501 — 7z2408 returns 404 on 7-zip.org as of 2025
  const BINARY_URLS: Record<string, string> = {
    "linux-x64": "https://7-zip.org/a/7z2501-linux-x64.tar.xz",
    "linux-arm64": "https://7-zip.org/a/7z2501-linux-arm64.tar.xz",
    "darwin-x64": "https://7-zip.org/a/7z2501-mac.tar.xz",
    "darwin-arm64": "https://7-zip.org/a/7z2501-mac.tar.xz",
  }

  async function downloadAndExtract7z() {
    const currentPlatform = platform()
    const currentArch = arch()
    const platformKey = `${currentPlatform}-${currentArch}`

    const downloadUrl = BINARY_URLS[platformKey]
    if (!downloadUrl) {
      throw new Error(`Unsupported platform: ${platformKey}`)
    }

    if (!existsSync(BINARY_DIR)) {
      await mkdir(BINARY_DIR)
    }

    const binaryPath = `${BINARY_DIR}/${BINARY_NAME}`

    if (existsSync(binaryPath)) {
      console.log("7z binary already exists")
      return
    }

    console.log("Downloading 7z...")
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download 7z from ${downloadUrl}: ${response.statusText}`)
    }

    const tempFile = "7z-temp.tar.xz"
    await Bun.write(tempFile, await response.arrayBuffer())

    console.log("Extracting 7z binary...")
    await Bun.spawn(["tar", "xf", tempFile]).exited
    await Bun.spawn(["mv", "7zz", binaryPath]).exited
    await chmod(binaryPath, 0o755)
    await Bun.spawn(["rm", tempFile]).exited

    console.log("7z binary setup complete")
  }

  await downloadAndExtract7z()
  