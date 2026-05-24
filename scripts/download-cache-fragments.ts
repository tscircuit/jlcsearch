import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"

const BASE_URL = "https://yaqwsx.github.io/jlcparts/data"
const OUTPUT_DIR = ".buildtmp"

async function downloadFile(url: string, outputPath: string): Promise<boolean> {
  const proc = Bun.spawn([
    "curl",
    "-L",
    "--retry",
    "3",
    "--retry-delay",
    "2",
    "--silent",
    "--show-error",
    "--output",
    outputPath,
    "--write-out",
    "%{http_code}",
    url,
  ])
  const statusText = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    await rm(outputPath, { force: true })
    throw new Error(`Failed to download ${url}`)
  }

  const statusCode = Number(statusText)
  if (statusCode === 404) {
    await rm(outputPath, { force: true })
    return false
  }

  if (statusCode < 200 || statusCode >= 300) {
    await rm(outputPath, { force: true })
    throw new Error(`Failed to download ${url}: HTTP ${statusCode}`)
  }

  console.log(`Downloaded: ${url}`)
  return true
}

async function main() {
  // Create output directory if it doesn't exist
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR)
  }

  console.log(`Downloading into ${OUTPUT_DIR}`)
  // Download initial cache.zip
  const downloadedCache = await downloadFile(
    `${BASE_URL}/cache.zip`,
    `${OUTPUT_DIR}/cache.zip`,
  )
  if (!downloadedCache) {
    throw new Error("Missing required cache.zip")
  }

  // Download fragments until we get a 404
  let index = 1
  while (true) {
    const paddedIndex = index.toString().padStart(2, "0")
    const success = await downloadFile(
      `${BASE_URL}/cache.z${paddedIndex}`,
      `${OUTPUT_DIR}/cache.z${paddedIndex}`,
    )

    if (!success) {
      console.log(`Stopped at index ${paddedIndex} (404 encountered)`)
      break
    }
    index++
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
