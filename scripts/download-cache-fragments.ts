import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"

const BASE_URL = "https://yaqwsx.github.io/jlcparts/data"
const OUTPUT_DIR = ".buildtmp"
const FRAGMENT_DOWNLOAD_CONCURRENCY = 6

async function downloadFile(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 404) {
        return false
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const fileData = await response.arrayBuffer()
    await Bun.write(outputPath, fileData)
    console.log(`Downloaded: ${url}`)
    return true
  } catch (error) {
    console.error(`Error downloading ${url}:`, error)
    return false
  }
}

async function main() {
  // Create output directory if it doesn't exist
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR)
  }

  console.log(`Downloading into ${OUTPUT_DIR}`)
  // Download initial cache.zip
  await downloadFile(`${BASE_URL}/cache.zip`, `${OUTPUT_DIR}/cache.zip`)

  // Download fragments until we get a 404. These are 50MB parts, so
  // bounded parallelism keeps CI setup under the workflow timeout.
  let index = 1
  while (true) {
    const fragmentIndexes = Array.from(
      { length: FRAGMENT_DOWNLOAD_CONCURRENCY },
      (_, offset) => index + offset,
    )
    const results = await Promise.all(
      fragmentIndexes.map((fragmentIndex) => {
        const paddedIndex = fragmentIndex.toString().padStart(2, "0")
        return downloadFile(
          `${BASE_URL}/cache.z${paddedIndex}`,
          `${OUTPUT_DIR}/cache.z${paddedIndex}`,
        )
      }),
    )
    const firstMissingIndex = results.findIndex((success) => !success)

    if (firstMissingIndex !== -1) {
      const missingFragmentIndex = fragmentIndexes[firstMissingIndex]
        .toString()
        .padStart(2, "0")
      console.log(`Stopped at index ${missingFragmentIndex} (404 encountered)`)
      break
    }
    index += FRAGMENT_DOWNLOAD_CONCURRENCY
  }
}

main().catch(console.error)
