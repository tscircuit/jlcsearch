import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"

const BASE_URL = "https://yaqwsx.github.io/jlcparts/data"
const OUTPUT_DIR = ".buildtmp"
const MAX_FRAGMENTS = 99
const CONCURRENCY = 8

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

async function downloadWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  let index = 0
  const run = async () => {
    while (index < tasks.length) {
      const task = tasks[index++]
      await task()
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run))
}

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR)
  }

  console.log(`Downloading into ${OUTPUT_DIR}`)

  // Probe sequentially to find fragment count (cheap HEAD requests)
  let fragmentCount = 0
  for (let i = 1; i <= MAX_FRAGMENTS; i++) {
    const paddedIndex = i.toString().padStart(2, "0")
    const url = `${BASE_URL}/cache.z${paddedIndex}`
    try {
      const res = await fetch(url, { method: "HEAD" })
      if (!res.ok) break
      fragmentCount = i
    } catch {
      break
    }
  }
  console.log(`Found ${fragmentCount} fragment(s)`)

  // Build download tasks: cache.zip + all fragments
  const tasks: Array<() => Promise<void>> = [
    async () => {
      await downloadFile(`${BASE_URL}/cache.zip`, `${OUTPUT_DIR}/cache.zip`)
    },
    ...Array.from({ length: fragmentCount }, (_, i) => {
      const paddedIndex = (i + 1).toString().padStart(2, "0")
      return async () => {
        await downloadFile(
          `${BASE_URL}/cache.z${paddedIndex}`,
          `${OUTPUT_DIR}/cache.z${paddedIndex}`,
        )
      }
    }),
  ]

  await downloadWithConcurrency(tasks, CONCURRENCY)
}

main().catch(console.error)
