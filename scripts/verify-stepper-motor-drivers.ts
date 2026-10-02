import { Database } from "bun:sqlite"

const db = new Database(process.env.SOURCE_DB_PATH || "db.sqlite3", {
  readonly: true,
})
try {
  // The public list is capped at 100 rows; compare the highest-stock records.
  const expected = db
    .query<{ lcsc: number; stock: number; mfr: string }, []>(
      "SELECT lcsc, stock, mfr FROM stepper_motor_driver ORDER BY stock DESC LIMIT 100",
    )
    .all()
  if (!expected.length)
    throw new Error("No prepared stepper motor driver stock to verify")
  for (const part of ["DRV8825", "DRV8818", "DRV8711"]) {
    if (
      !db
        .query("SELECT 1 FROM stepper_motor_driver WHERE mfr LIKE ?")
        .get(`${part}%`)
    ) {
      throw new Error(`Missing live ${part} in prepared stepper motor drivers`)
    }
  }
  const base = "https://jlcsearch.tscircuit.com/stepper_motor_drivers/list"
  // Refresh unfiltered and package-filtered HTML/JSON through the supported
  // cachebust mechanism so the public page immediately uses the new data.
  const packages = db
    .query<{ value: string }, []>(
      "SELECT DISTINCT package AS value FROM stepper_motor_driver WHERE package IS NOT NULL",
    )
    .all()
    .map((row) => row.value)
  const queries = new Set([""])
  for (const packageValue of ["", ...packages]) {
    queries.add(new URLSearchParams({ package: packageValue }).toString())
  }
  for (const query of queries) {
    for (const extension of ["", ".json"]) {
      const url = new URL(base + extension)
      url.search = query
      url.searchParams.set("cachebust", "1")
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      await response.text()
      if (!response.ok)
        throw new Error(
          `Stepper motor driver cache refresh HTTP ${response.status}`,
        )
    }
  }
  for (const suffix of [".json?cachebust=1", ".json"]) {
    const response = await fetch(base + suffix, {
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok)
      throw new Error(`Stepper motor driver API HTTP ${response.status}`)
    const body: any = await response.json()
    for (const row of expected) {
      const actual = body.stepper_motor_drivers?.find(
        (c: any) => c.lcsc === row.lcsc,
      )
      if (!actual || actual.stock !== row.stock || actual.mfr !== row.mfr) {
        throw new Error(
          `Stepper motor driver API missing current stock for C${row.lcsc}`,
        )
      }
    }
  }
  for (const suffix of ["?cachebust=1", ""]) {
    const response = await fetch(base + suffix, {
      signal: AbortSignal.timeout(30_000),
    })
    const html = await response.text()
    if (
      !response.ok ||
      expected.some((row) => !html.includes(`/C${row.lcsc}`))
    ) {
      throw new Error(
        "Stepper motor driver HTML does not contain the highest-stock drivers",
      )
    }
  }
  console.log(
    `Verified ${expected.length} stepper motor drivers and refreshed HTML/JSON caches`,
  )
} finally {
  db.close()
}
