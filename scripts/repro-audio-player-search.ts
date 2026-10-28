// Run manually: bun scripts/repro-audio-player-search.ts [service-origin]
// Exit 1 reproduces the missing name match; exit 2 means the check is inconclusive.
// These are J3 and U5 from the public Pocket Audio Player 0.4.0-rc.9 BOM.
// Only component identifiers are copied; no board geometry or supplier models.
const board = {
  url: "https://tscircuit.com/gokul/pocket-audio-player",
  version: "0.4.0-rc.9",
  bom: "output/fabrication/bom-jlcpcb.csv",
}

const boardParts = [
  { reference: "J3", mfr: "PJ-320D", lcsc: 431535 },
  { reference: "U5", mfr: "XC6206P182MR", lcsc: 21659 },
]

interface SearchComponent {
  lcsc: number
  mfr: string
  description: string
  stock: number
}

const origin = process.argv[2] ?? "https://jlcsearch.tscircuit.com"

async function search(q: string) {
  const url = new URL("/api/search", origin)
  url.searchParams.set("limit", "10")
  url.searchParams.set("q", q)
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  const body = (await response.json()) as {
    components: SearchComponent[]
  }
  if (!Array.isArray(body.components)) {
    throw new Error(`${url}: missing components array`)
  }
  return {
    url: url.toString(),
    httpStatus: response.status,
    cache: response.headers.get("x-cache"),
    components: body.components.map(({ lcsc, mfr, description, stock }) => ({
      lcsc,
      mfr,
      description,
      stock,
    })),
  }
}

try {
  const results = []
  for (const part of boardParts) {
    const byCode = await search(`C${part.lcsc}`)
    const byName = await search(part.mfr)
    const stockedPartExists = byCode.components.some(
      (component) =>
        component.lcsc === part.lcsc &&
        component.mfr === part.mfr &&
        component.stock > 0,
    )
    const nameMatchExists = byName.components.some(
      (component) => component.lcsc === part.lcsc && component.mfr === part.mfr,
    )
    const outcome = !stockedPartExists
      ? "inconclusive_code_lookup"
      : nameMatchExists
        ? "matched"
        : "missing_from_name_search"
    results.push({ ...part, outcome, byCode, byName })
  }
  console.log(
    JSON.stringify(
      { board, checkedAt: new Date().toISOString(), results },
      null,
      2,
    ),
  )
  process.exitCode = results.some(
    (result) => result.outcome === "inconclusive_code_lookup",
  )
    ? 2
    : results.some((result) => result.outcome === "missing_from_name_search")
      ? 1
      : 0
} catch (error) {
  console.error("Search reproduction inconclusive:", error)
  process.exitCode = 2
}
