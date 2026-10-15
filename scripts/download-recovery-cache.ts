import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import manifest from "./source-recovery-manifest.json"

const directory = process.env.RECOVERY_ARCHIVE_DIR || ".recovery"
const base = `https://raw.githubusercontent.com/yaqwsx/jlcparts/${manifest.commit}/data`
await mkdir(directory, { recursive: true })
for (const entry of manifest.files) {
  const output = `${directory}/${entry.name}`
  const existing = Bun.file(output)
  let bytes = (await existing.exists()) ? await existing.arrayBuffer() : null
  const valid = (data: ArrayBuffer) =>
    data.byteLength === entry.size &&
    createHash("sha1")
      .update(`blob ${entry.size}\0`)
      .update(new Uint8Array(data))
      .digest("hex") === entry.sha
  if (!bytes || !valid(bytes)) {
    bytes = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${base}/${entry.name}`, {
          signal: AbortSignal.timeout(120_000),
        })
        if (!response.ok)
          throw new Error(`Recovery download HTTP ${response.status}`)
        const downloaded = await response.arrayBuffer()
        if (!valid(downloaded))
          throw new Error(`Recovery checksum mismatch: ${entry.name}`)
        bytes = downloaded
        break
      } catch (error) {
        if (attempt === 3) throw error
        await Bun.sleep(1000 * attempt)
      }
    }
    if (!bytes) throw new Error(`Recovery download failed: ${entry.name}`)
    await Bun.write(output, bytes)
  }
  console.log(`Verified recovery archive ${entry.name}`)
}
