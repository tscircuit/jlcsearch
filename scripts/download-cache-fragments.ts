import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"

const BASE_URL = "https://yaqwsx.github.io/jlcparts/data"
const OUTPUT_DIR = ".buildtmp"
const DOWNLOAD_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.CACHE_FRAGMENT_DOWNLOAD_CONCURRENCY ?? "4", 10) ||
    4,
)

async function downloadFile(
  url: string,
  outputPath: string,
): Promise<"downloaded" | "missing"> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 404) {
        return "missing"
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const fileData = await response.arrayBuffer()
    await Bun.write(outputPath, fileData)
    console.log(`Downloaded: ${url} (${fileData.byteLength} bytes)`)
    return "downloaded"
  } catch (error) {
    console.error(`Error downloading ${url}:`, error)
    throw error
  }
}

async function downloadFragmentBatch(startIndex: number) {
  const downloads = Array.from(
    { length: DOWNLOAD_CONCURRENCY },
    (_, offset) => {
      const index = startIndex + offset
      const paddedIndex = index.toString().padStart(2, "0")

      return {
        index,
        paddedIndex,
        promise: downloadFile(
          `${BASE_URL}/cache.z${paddedIndex}`,
          `${OUTPUT_DIR}/cache.z${paddedIndex}`,
        ),
      }
    },
  )

  const results = await Promise.all(
    downloads.map(async ({ index, paddedIndex, promise }) => ({
      index,
      paddedIndex,
      status: await promise,
    })),
  )

  return results.sort((a, b) => a.index - b.index)
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
    const results = await downloadFragmentBatch(index)
    const missing = results.find((result) => result.status === "missing")

    if (missing) {
      console.log(`Stopped at index ${missing.paddedIndex} (404 encountered)`)
      break
    }

    index += DOWNLOAD_CONCURRENCY
  }
}

main().catch(console.error)
