import { existsSync } from "node:fs"
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
} from "node:fs/promises"
import { arch, platform, tmpdir } from "node:os"
import { join } from "node:path"

const BINARY_DIR = ".bin"
const SEVEN_ZIP_VERSION = "26.02"
const SEVEN_ZIP_ARCHIVE_VERSION = SEVEN_ZIP_VERSION.replace(".", "")
const RELEASE_BASE_URL = `https://github.com/ip7z/7zip/releases/download/${SEVEN_ZIP_VERSION}`

const POSIX_BINARY_URLS: Record<string, string> = {
  "linux-x64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-linux-x64.tar.xz`,
  "linux-arm64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-linux-arm64.tar.xz`,
  "darwin-x64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-mac.tar.xz`,
  "darwin-arm64": `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-mac.tar.xz`,
}

const WINDOWS_BOOTSTRAP_URL = `${RELEASE_BASE_URL}/7zr.exe`
const WINDOWS_EXTRA_ARCHIVE_URL = `${RELEASE_BASE_URL}/7z${SEVEN_ZIP_ARCHIVE_VERSION}-extra.7z`

export type SevenZipSetupPlan =
  | {
      kind: "posix"
      binaryName: "7zz"
      archiveUrl: string
    }
  | {
      kind: "windows"
      binaryName: "7za.exe"
      bootstrapUrl: string
      archiveUrl: string
      preferredArch: string
    }

export function getSevenZipSetupPlan(
  currentPlatform = platform(),
  currentArch = arch(),
): SevenZipSetupPlan {
  if (currentPlatform === "win32") {
    const preferredArch =
      currentArch === "x64"
        ? "x64"
        : currentArch === "arm64"
          ? "arm64"
          : currentArch === "ia32"
            ? "x86"
            : currentArch

    return {
      kind: "windows",
      binaryName: "7za.exe",
      bootstrapUrl: WINDOWS_BOOTSTRAP_URL,
      archiveUrl: WINDOWS_EXTRA_ARCHIVE_URL,
      preferredArch,
    }
  }

  const archiveUrl = POSIX_BINARY_URLS[`${currentPlatform}-${currentArch}`]
  if (!archiveUrl) {
    throw new Error(
      `Unsupported platform: ${currentPlatform}-${currentArch}`,
    )
  }

  return {
    kind: "posix",
    binaryName: "7zz",
    archiveUrl,
  }
}

async function downloadFile(url: string, destination: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ${response.status} ${response.statusText}`,
    )
  }
  await Bun.write(destination, await response.arrayBuffer())
}

async function run(command: string[]) {
  const process = Bun.spawn(command, {
    stdout: "inherit",
    stderr: "inherit",
  })
  const exitCode = await process.exited
  if (exitCode !== 0) {
    throw new Error(
      `Command failed with exit code ${exitCode}: ${command.join(" ")}`,
    )
  }
}

async function findFilesNamed(
  directory: string,
  fileName: string,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const matches: string[] = []

  for (const entry of entries) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      matches.push(...(await findFilesNamed(entryPath, fileName)))
    } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
      matches.push(entryPath)
    }
  }

  return matches
}

function selectWindows7za(
  candidates: string[],
  preferredArch: string,
): string | undefined {
  const normalizedArch = `/${preferredArch.toLowerCase()}/`
  return (
    candidates.find((candidate) =>
      candidate.replaceAll("\\", "/").toLowerCase().includes(normalizedArch),
    ) ??
    candidates.find((candidate) => {
      const normalized = candidate.replaceAll("\\", "/").toLowerCase()
      return (
        !normalized.includes("/x64/") &&
        !normalized.includes("/arm64/") &&
        !normalized.includes("/x86/")
      )
    }) ??
    candidates[0]
  )
}

async function setupPosix(
  archiveUrl: string,
  binaryPath: string,
): Promise<void> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "jlcsearch-7zip-"))

  try {
    const archivePath = join(tempDirectory, "7z.tar.xz")
    const extractDirectory = join(tempDirectory, "extract")
    await mkdir(extractDirectory)

    console.log("Downloading 7z...")
    await downloadFile(archiveUrl, archivePath)

    console.log("Extracting 7z binary...")
    await run(["tar", "xf", archivePath, "-C", extractDirectory])

    const candidates = await findFilesNamed(extractDirectory, "7zz")
    const sourceBinary = candidates[0]
    if (!sourceBinary) {
      throw new Error("7zz was not found in the downloaded archive")
    }

    await copyFile(sourceBinary, binaryPath)
    await chmod(binaryPath, 0o755)
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
}

async function setupWindows(
  plan: Extract<SevenZipSetupPlan, { kind: "windows" }>,
  binaryPath: string,
): Promise<void> {
  const tempDirectory = await mkdtemp(join(tmpdir(), "jlcsearch-7zip-"))

  try {
    const bootstrapPath = join(tempDirectory, "7zr.exe")
    const archivePath = join(tempDirectory, "7z-extra.7z")
    const extractDirectory = join(tempDirectory, "extract")
    await mkdir(extractDirectory)

    console.log("Downloading official 7-Zip Windows bootstrap...")
    await Promise.all([
      downloadFile(plan.bootstrapUrl, bootstrapPath),
      downloadFile(plan.archiveUrl, archivePath),
    ])

    console.log("Extracting official 7za.exe...")
    await run([
      bootstrapPath,
      "x",
      archivePath,
      `-o${extractDirectory}`,
      "-y",
    ])

    const candidates = await findFilesNamed(extractDirectory, "7za.exe")
    const sourceBinary = selectWindows7za(candidates, plan.preferredArch)
    if (!sourceBinary) {
      throw new Error("7za.exe was not found in the downloaded extra archive")
    }

    await copyFile(sourceBinary, binaryPath)
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
}

export async function downloadAndExtract7z() {
  const plan = getSevenZipSetupPlan()
  await mkdir(BINARY_DIR, { recursive: true })

  const binaryPath = join(BINARY_DIR, plan.binaryName)
  if (existsSync(binaryPath)) {
    console.log("7z binary already exists")
    return
  }

  if (plan.kind === "windows") {
    await setupWindows(plan, binaryPath)
  } else {
    await setupPosix(plan.archiveUrl, binaryPath)
  }

  console.log("7z binary setup complete")
}

if (import.meta.main) {
  await downloadAndExtract7z()
}
