import { Database } from "bun:sqlite"

const db = new Database("db.sqlite3", { readonly: true })
try {
  // The public list is capped at 100 rows; compare the highest-stock records.
  const expected = db
    .query<{ lcsc: number; stock: number }, []>(
      "SELECT lcsc, stock FROM oled_display WHERE stock > 0 ORDER BY stock DESC LIMIT 100",
    )
    .all()
  if (!expected.length) throw new Error("No prepared OLED stock to verify")
  const base = "https://jlcsearch.tscircuit.com/oled_display/list"
  for (const suffix of [".json?cachebust=1", ".json"]) {
    const response = await fetch(base + suffix)
    if (!response.ok) throw new Error(`OLED API HTTP ${response.status}`)
    const body: any = await response.json()
    for (const row of expected) {
      const actual = body.oled_displays?.find((c: any) => c.lcsc === row.lcsc)
      if (!actual || actual.stock !== row.stock) {
        throw new Error(`OLED API missing current stock for C${row.lcsc}`)
      }
    }
  }
  for (const suffix of ["?cachebust=1", ""]) {
    const response = await fetch(base + suffix)
    const html = await response.text()
    if (!response.ok || !html.includes(`/C${expected[0].lcsc}`)) {
      throw new Error("OLED HTML does not contain the highest-stock display")
    }
  }
  console.log(
    `Verified ${expected.length} in-stock OLEDs and refreshed HTML/JSON caches`,
  )
} finally {
  db.close()
}
