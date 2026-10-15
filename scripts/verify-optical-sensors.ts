import { Database } from "bun:sqlite"

const db = new Database("db.sqlite3", { readonly: true })
try {
  const types = db
    .query<{ sensor_type: string }, []>(
      "SELECT DISTINCT sensor_type FROM optical_sensor ORDER BY sensor_type",
    )
    .all()
    .map((row) => row.sensor_type)
  if (!types.includes("Optical Motion"))
    throw new Error("Prepared optical sensors have no motion sensors")
  const base = "https://jlcsearch.tscircuit.com/optical_sensors/list"
  // Verify each type separately because the public list is capped at 100.
  // Include zero-stock navigation sensors in the check; they are catalogued
  // parts users may source/pre-order, rather than missing sensors.
  for (const sensorType of types) {
    const expected = db
      .query<{ lcsc: number; stock: number }, [string]>(
        "SELECT lcsc, stock FROM optical_sensor WHERE sensor_type = ? ORDER BY stock DESC, lcsc ASC LIMIT 100",
      )
      .all(sensorType)
    const queries: Array<Record<string, string>> = [
      { sensor_type: sensorType },
      { package: "", sensor_type: sensorType, is_basic: "", is_preferred: "" },
      {
        package: "",
        sensor_type: sensorType,
        in_stock: "",
        is_basic: "",
        is_preferred: "",
      },
    ]
    for (const params of queries) {
      for (const extension of [".json", ""]) {
        const url = new URL(base + extension)
        url.search = new URLSearchParams(params).toString()
        url.searchParams.set("cachebust", "1")
        const response = await fetch(url)
        if (!response.ok)
          throw new Error(`Optical sensor API HTTP ${response.status}`)
        if (extension) {
          const body: any = await response.json()
          // Compare the API's top-stock set without relying on a tie-break order.
          const cutoff = expected.at(-1)?.stock ?? 0
          for (const row of expected.filter(
            (r) => expected.length < 100 || r.stock > cutoff,
          )) {
            if (
              !body.optical_sensors?.some(
                (r: any) => r.lcsc === row.lcsc && r.stock === row.stock,
              )
            ) {
              throw new Error(`Optical API missing live stock for C${row.lcsc}`)
            }
          }
          if (sensorType === "Optical Motion") {
            const pmw = db
              .query<{ stock: number }, []>(
                "SELECT stock FROM optical_sensor WHERE lcsc=20612443",
              )
              .get()
            if (
              !pmw ||
              !body.optical_sensors?.some(
                (r: any) =>
                  r.lcsc === 20612443 &&
                  r.stock === pmw.stock &&
                  r.in_stock === pmw.stock > 0,
              )
            ) {
              throw new Error(
                "Optical Motion API is missing PMW3360 C20612443 or misreports its stock",
              )
            }
          }
        } else {
          const html = await response.text()
          if (!html.includes("<h2>Optical Sensors</h2>"))
            throw new Error("Missing optical sensor HTML page")
          if (sensorType === "Optical Motion" && !html.includes("/C20612443"))
            throw new Error("Optical Motion HTML is missing PMW3360")
        }
      }
    }
  }
  for (const extension of ["", ".json"]) {
    const response = await fetch(`${base}${extension}?cachebust=1`)
    await response.text()
    if (!response.ok)
      throw new Error(`Optical cache refresh HTTP ${response.status}`)
  }
  console.log(
    `Verified ${types.length} optical sensor types, PMW3360 (including zero stock), and refreshed HTML/JSON caches`,
  )
} finally {
  db.close()
}
