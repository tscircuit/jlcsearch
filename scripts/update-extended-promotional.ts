import { readFileSync } from "node:fs"
import { getDbClient } from "lib/db/get-db-client"

const parseLcscCodes = (input: string): number[] => {
  const codes = new Set<number>()

  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const normalized = trimmed.toLowerCase().startsWith("c")
      ? trimmed.slice(1)
      : trimmed
    const lcsc = Number.parseInt(normalized, 10)

    if (!Number.isNaN(lcsc)) {
      codes.add(lcsc)
    }
  }

  return [...codes]
}

const readInput = async (path: string): Promise<string> => {
  if (path === "-") {
    return await Bun.stdin.text()
  }

  return readFileSync(path, "utf8")
}

const main = async () => {
  const inputPath = process.argv[2]

  if (!inputPath) {
    console.error(
      "Usage: bun run scripts/update-extended-promotional.ts <codes-file|->",
    )
    process.exit(1)
  }

  const codes = parseLcscCodes(await readInput(inputPath))

  if (codes.length === 0) {
    console.error(
      "No extended promotional LCSC codes were provided; refusing to update the database with empty source data.",
    )
    process.exit(1)
  }

  const db = getDbClient()

  try {
    await db
      .updateTable("components")
      .set({ extended_promotional: 0 })
      .execute()

    const batchSize = 500
    let updatedRows = 0

    for (let index = 0; index < codes.length; index += batchSize) {
      const batch = codes.slice(index, index + batchSize)
      const result = await db
        .updateTable("components")
        .set({ extended_promotional: 1 })
        .where("lcsc", "in", batch)
        .executeTakeFirst()

      updatedRows += Number(result.numUpdatedRows ?? 0)
    }

    if (updatedRows === 0) {
      throw new Error(
        "The source list was non-empty, but none of its LCSC codes matched local components.",
      )
    }

    console.error(
      `Marked ${updatedRows} components as extended promotional from ${codes.length} source codes.`,
    )
  } finally {
    await db.destroy()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
