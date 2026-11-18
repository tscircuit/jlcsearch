import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { ledTableSpec } from "lib/db/derivedtables/led"

test("led table selects LED Indication - Discrete alongside legacy LED subcategories", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (column) => column.primaryKey())
      .addColumn("category", "text", (column) => column.notNull())
      .addColumn("subcategory", "text", (column) => column.notNull())
      .execute()
    await db.schema
      .createTable("components")
      .addColumn("lcsc", "integer", (column) => column.primaryKey())
      .addColumn("category_id", "integer", (column) => column.notNull())
      .execute()

    await db
      .insertInto("categories")
      .values([
        {
          id: 1,
          category: "Optoelectronics",
          subcategory: "LED Indication - Discrete",
        },
        {
          id: 2,
          category: "Optocouplers & LEDs & Infrared",
          subcategory: "Light Emitting Diodes (LED)",
        },
        {
          id: 3,
          category: "Photoelectric Devices",
          subcategory: "Ultra Violet LEDs",
        },
        {
          id: 4,
          category: "Optoelectronics",
          subcategory: "Infrared (IR) LEDs",
        },
        {
          id: 5,
          category: "Photoelectric Devices",
          subcategory: "Photodiodes",
        },
        {
          id: 6,
          category: "Photoelectric Devices",
          subcategory: "RGB LEDs(Built-In IC)",
        },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        { lcsc: 2286, category_id: 1 },
        { lcsc: 965808, category_id: 2 },
        { lcsc: 1001, category_id: 3 },
        { lcsc: 50494, category_id: 4 },
        { lcsc: 161211, category_id: 5 },
        { lcsc: 5149201, category_id: 6 },
      ])
      .execute()

    const candidates = await ledTableSpec.listCandidateComponents(db).execute()

    expect(
      candidates.map((candidate) => candidate.lcsc).sort((a, b) => a - b),
    ).toEqual([1001, 2286, 50494, 965808])
  } finally {
    await db.destroy()
  }
})

test("led table maps LED Indication - Discrete metadata and description fallbacks", () => {
  const mapped = ledTableSpec.mapToTable([
    {
      lcsc: 2286,
      mfr: "KT-0603R",
      description:
        "-40℃~+85℃ 1.8V~2.4V 120° 20mA 300mcd 40mW 615nm~630nm 645nm Discrete Diode Red Water Clear 0603 LED Indication - Discrete ROHS",
      stock: 5724023,
      basic: 1,
      preferred: 0,
      price: "1-999:0.0073,1000-3999:0.0056",
      package: "0603",
      extra: null,
    } as any,
    {
      lcsc: 2290,
      mfr: "KT-0603W",
      description:
        "-40℃~+85℃ 100mW 120° 2.6V~3.1V 360mcd 5mA Discrete Diode Top-mount White Yellow Lens 0603 LED Indication - Discrete ROHS",
      stock: 2591930,
      basic: 1,
      preferred: 0,
      price: "1-499:0.0122,500-1499:0.0094",
      package: "0603",
      extra: null,
    } as any,
    {
      lcsc: 6784992,
      mfr: "150060SS75000",
      description: "",
      stock: 3837,
      basic: 0,
      preferred: 0,
      price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.2397 }]),
      package: "0603",
      extra: JSON.stringify({
        attributes: {
          "Illumination Color": "Red",
          "Lens Color": "Water Clear",
          "Luminous Intensity": "60mcd",
          "Operating Temperature": "-40℃~+85℃",
          "Peak Wavelength": "645nm",
          "Power(Watts)": "72mW",
          "Test Current": "20mA",
          "Viewing Angle": "140°",
          "Voltage - Forward(Vf)": "1.9V",
          "Wavelength - Dominant": "630nm",
        },
      }),
    } as any,
    {
      lcsc: 965808,
      mfr: "XL-1608UWC-04",
      description: "0603 White LED Indication - Discrete ROHS",
      stock: 1740000,
      basic: 0,
      preferred: 0,
      price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.0035 }]),
      package: "0603",
      extra: JSON.stringify({
        attributes: {
          "Emitted Color": "White light",
          "Forward Current": "25mA",
          "Lens Color": "Yellow",
          "Mounting Sytle": "Positive post",
          "Power Dissipation": "80mW",
          "Viewing Angle": "120°",
        },
      }),
    } as any,
  ])

  expect(mapped[0]).toMatchObject({
    lcsc: 2286,
    package: "0603",
    is_basic: true,
    color: "red",
    lens_color: "clear-water",
    forward_voltage: 1.8,
    forward_current: 0.02,
    luminous_intensity_mcd: 300,
    viewing_angle_deg: 120,
    power_dissipation_mw: 40,
    wavelength_nm: 615,
    operating_temp_min: -40,
    operating_temp_max: 85,
  })

  expect(mapped[1]).toMatchObject({
    lcsc: 2290,
    package: "0603",
    is_basic: true,
    color: "white",
    lens_color: "yellow",
    forward_voltage: 2.6,
    forward_current: 0.005,
    luminous_intensity_mcd: 360,
    viewing_angle_deg: 120,
    power_dissipation_mw: 100,
  })

  expect(mapped[2]).toMatchObject({
    lcsc: 6784992,
    color: "red",
    lens_color: "clear-water",
    forward_voltage: 1.9,
    forward_current: 0.02,
    wavelength_nm: 630,
    luminous_intensity_mcd: 60,
    viewing_angle_deg: 140,
    power_dissipation_mw: 72,
    operating_temp_min: -40,
    operating_temp_max: 85,
  })

  expect(mapped[3]).toMatchObject({
    lcsc: 965808,
    color: "white",
    lens_color: "yellow",
    mounting_style: "Positive post",
    forward_current: 0.025,
    power_dissipation_mw: 80,
    viewing_angle_deg: 120,
  })
})
