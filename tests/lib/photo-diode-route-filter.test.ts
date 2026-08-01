import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { getD1Handler } from "../../cf-proxy/src/d1-routes"

test("photo diode wavelength filter matches detection ranges", async () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE photo_diode (
      lcsc INTEGER PRIMARY KEY,
      mfr TEXT,
      stock INTEGER,
      package TEXT,
      peak_wavelength_nm REAL,
      spectral_range_min_nm REAL,
      spectral_range_max_nm REAL,
      reverse_voltage REAL,
      dark_current_a REAL,
      is_basic BOOLEAN,
      is_preferred BOOLEAN
    );

    INSERT INTO photo_diode (
      lcsc, mfr, stock, package, peak_wavelength_nm,
      spectral_range_min_nm, spectral_range_max_nm,
      reverse_voltage, dark_current_a, is_basic, is_preferred
    ) VALUES
      (1, 'IR_ONLY', 400, 'SMD', 940, 840, 1100, 20, 1e-9, 0, 0),
      (2, 'UV_TO_IR', 300, 'SMD', 940, 300, 1100, 20, 1e-9, 0, 0),
      (3, 'PEAK_300_ONLY', 200, 'SMD', 300, NULL, NULL, 20, 1e-9, 0, 0),
      (4, 'UNKNOWN_RANGE', 100, 'SMD', 940, NULL, NULL, 20, 1e-9, 0, 0),
      (5, 'UV_PEAK', 50, 'SMD', 360, 300, 400, 20, 1e-9, 0, 0),
      (6, 'BLUE_PEAK', 40, 'SMD', 420, 300, 950, 20, 1e-9, 0, 0);
  `)

  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    const handler = getD1Handler("/photo_diodes/list")
    expect(handler).not.toBeNull()

    const result = await handler!(db as any, { wavelength: "300" })
    const rows = result.data.photo_diodes as Array<{
      lcsc: number
      mfr: string
    }>

    expect(rows.map((row) => row.lcsc)).toEqual([3, 5, 6, 2])
    expect(rows.map((row) => row.mfr)).toEqual([
      "PEAK_300_ONLY",
      "UV_PEAK",
      "BLUE_PEAK",
      "UV_TO_IR",
    ])

    const selectiveResult = await handler!(db as any, {
      wavelength: "355",
      peak_distance_max: "100",
      excluded_peak_bands: "400-500, 700-1100",
    })
    const selectiveRows = selectiveResult.data.photo_diodes as Array<{
      lcsc: number
    }>
    expect(selectiveRows.map((row) => row.lcsc)).toEqual([5])

    const legacyResult = await handler!(db as any, {
      wavelength_min: "300",
    })
    const legacyRows = legacyResult.data.photo_diodes as Array<{ lcsc: number }>
    expect(legacyRows.map((row) => row.lcsc)).toEqual([3, 5, 6, 2])
  } finally {
    await db.destroy()
  }
})
