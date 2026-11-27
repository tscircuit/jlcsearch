import { mkdir, rename, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { encodeCatalog, type StandaloneComponent } from "./catalog"

export const commonQueries = [
  "C2040",
  "C14663",
  "C25804",
  "C17414",
  "C25744",
  "C2286",
  "C2290",
  "C1525",
  "C19702",
  "C6186",
  "C81598",
  "C165948",
  "C52923",
  "C1815",
  "C46749",
  "C12367",
  "C34743",
  "C2128",
  "C6188",
  "C1817",
]

export async function buildStandaloneJlcsearch(
  options: {
    outputPath?: string
    queries?: string[]
    fetch?: typeof globalThis.fetch
    generatedAt?: string
  } = {},
) {
  const components: StandaloneComponent[] = []
  // Bounded build-time requests only. Runtime searches never need this endpoint.
  for (const query of options.queries ?? commonQueries) {
    const url = new URL("https://jlcsearch.tscircuit.com/api/search")
    url.searchParams.set("limit", "10")
    url.searchParams.set("q", query)
    const response = await (options.fetch ?? fetch)(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok)
      throw new Error(`JLCPCB ${query}: HTTP ${response.status}`)
    const body = await response.json()
    if (!Array.isArray(body?.components))
      throw new Error(`Invalid JLCPCB response for ${query}`)
    components.push(...body.components)
  }
  const compressed = encodeCatalog(components, options.generatedAt)
  const outputPath = resolve(
    options.outputPath ?? "standalone-jlcsearch/search-catalog.json.gz",
  )
  await mkdir(dirname(outputPath), { recursive: true })
  const temporaryPath = `${outputPath}.${crypto.randomUUID()}.tmp`
  await writeFile(temporaryPath, compressed)
  await rename(temporaryPath, outputPath)
  return { outputPath, gzipBytes: compressed.length }
}

if (import.meta.main)
  console.log(await buildStandaloneJlcsearch({ outputPath: Bun.argv[2] }))
