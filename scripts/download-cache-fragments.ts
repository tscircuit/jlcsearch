import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"

const BASE_URL = "https://yaqwsx.github.io/jlcparts/data"
const OUTPUT_DIR = ".buildtmp"
const CONCURRENT_FRAGMENT_DOWNLOADS = 8

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

  // Download fragments until we get a 404. These files are large, so fetch
  // them in small batches to keep CI setup under the workflow timeout.
  let index = 1
  while (true) {
    const fragmentIndexes = Array.from(
      { length: CONCURRENT_FRAGMENT_DOWNLOADS },
      (_, offset) => index + offset,
    )
    const results = await Promise.all(
      fragmentIndexes.map(async (fragmentIndex) => {
        const paddedIndex = fragmentIndex.toString().padStart(2, "0")
        const success = await downloadFile(
          `${BASE_URL}/cache.z${paddedIndex}`,
          `${OUTPUT_DIR}/cache.z${paddedIndex}`,
        )
        return { paddedIndex, success }
      }),
    )

    const firstMissingFragment = results.find((result) => !result.success)
    if (firstMissingFragment) {
      console.log(
        `Stopped at index ${firstMissingFragment.paddedIndex} (404 encountered)`,
      )
      break
    }
    index += CONCURRENT_FRAGMENT_DOWNLOADS
  }
}

main().catch(console.error)
