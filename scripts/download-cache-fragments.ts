import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"

const BASE_URL = "https://yaqwsx.github.io/jlcparts/data"
const OUTPUT_DIR = ".buildtmp"

async function downloadFile(
  url: string,
  outputPath: string,
): Promise<"downloaded" | "not-found"> {
  const response = await fetch(url)
  if (!response.ok) {
    if (response.status === 404) {
      return "not-found"
    }
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  }

  const fileData = await response.arrayBuffer()
  await Bun.write(outputPath, fileData)
  console.log(`Downloaded: ${url}`)
  return "downloaded"
}

async function main() {
  // Create output directory if it doesn't exist
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR)
  }

  console.log(`Downloading into ${OUTPUT_DIR}`)
  // Download initial cache.zip
  const initialArchive = await downloadFile(
    `${BASE_URL}/cache.zip`,
    `${OUTPUT_DIR}/cache.zip`,
  )
  if (initialArchive === "not-found") {
    throw new Error("The initial cache.zip archive does not exist")
  }

  // Download fragments until we get a 404
  let index = 1
  while (true) {
    const paddedIndex = index.toString().padStart(2, "0")
    const result = await downloadFile(
      `${BASE_URL}/cache.z${paddedIndex}`,
      `${OUTPUT_DIR}/cache.z${paddedIndex}`,
    )

    if (result === "not-found") {
      console.log(`Stopped at index ${paddedIndex} (404 encountered)`)
      break
    }
    index++
  }
}

await main()
