import { Database } from "bun:sqlite"

const db = new Database(process.env.SOURCE_DB_PATH || "db.sqlite3", {
  readonly: true,
})
try {
  const expected = db
    .query<{ lcsc: number; stock: number; description: string }, []>(
      "SELECT lcsc, stock, description FROM spring_clamp_terminal_block ORDER BY stock DESC LIMIT 100",
    )
    .all()
  if (
    !expected.some((row) => row.stock > 0 && /\bWAGO\b/i.test(row.description))
  ) {
    throw new Error("Prepared spring-clamp list has no stocked WAGO connectors")
  }
  for (const route of [
    "spring_clamp_connectors",
    "spring_clamp_terminal_blocks",
  ]) {
    const base = "https://jlcsearch.tscircuit.com/" + route + "/list"
    for (const suffix of [".json?cachebust=1", ".json"]) {
      const response = await fetch(base + suffix)
      if (!response.ok)
        throw new Error("Spring-clamp API HTTP " + response.status)
      const body: any = await response.json()
      for (const row of expected) {
        const actual = body.spring_clamp_terminal_blocks?.find(
          (c: any) => c.lcsc === row.lcsc,
        )
        if (!actual || actual.stock !== row.stock) {
          throw new Error(
            "Spring-clamp API missing current stock for C" + row.lcsc,
          )
        }
      }
    }
    for (const suffix of ["?cachebust=1", ""]) {
      const response = await fetch(base + suffix)
      const html = await response.text()
      if (!response.ok || !html.includes("WAGO")) {
        throw new Error("Spring-clamp HTML does not show WAGO connectors")
      }
    }
  }
  console.log(
    "Verified stocked WAGO connectors in both spring-clamp HTML/JSON routes",
  )
} finally {
  db.close()
}
