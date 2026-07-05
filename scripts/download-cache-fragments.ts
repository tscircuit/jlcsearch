import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"

const BASE_URL = "https://yaqwsx.github.io/jlcparts/data"
const OUTPUT_DIR = ".buildtmp"

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

main().catch(console.error)
