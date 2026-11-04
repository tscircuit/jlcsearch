import type { Database } from "bun:sqlite"

// JLCPCB lists C42388007 as Rockchip / Microcontrollers (MCU/MPU/SOC),
// while jlcparts currently publishes an empty manufacturer and Others/Others.
// Verified 2026-11-04: https://jlcpcb.com/partdetail/Rockchip-RK3576/C42388007
// Correct identity metadata only; never synthesize stock, prices or presence.
export function correctSourceMetadata(database: Database) {
  const columns = database
    .query<{ name: string }, []>("PRAGMA table_info(input_jlc_components)")
    .all()
  const corrections: Record<string, string> = {
    manufacturer:
      "CASE WHEN trim(manufacturer) = '' THEN 'Rockchip' ELSE manufacturer END",
    category:
      "CASE WHEN category = 'Others' THEN 'Embedded Processors & Controllers' ELSE category END",
    subcategory:
      "CASE WHEN subcategory = 'Others' THEN 'Microcontrollers (MCU/MPU/SOC)' ELSE subcategory END",
  }
  const projection = columns.map(({ name }) => {
    const quoted = `"${name.replaceAll('"', '""')}"`
    return corrections[name]
      ? `CASE WHEN lcsc = 42388007 AND mfr = 'RK3576'
          THEN ${corrections[name]} ELSE ${quoted} END AS ${quoted}`
      : quoted
  })
  database.exec(`CREATE TEMP VIEW corrected_jlc_components AS
    SELECT ${projection.join(",")} FROM input_jlc_components`)
}
