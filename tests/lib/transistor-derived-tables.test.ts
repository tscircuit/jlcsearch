import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { bjtTransistorTableSpec } from "lib/db/derivedtables/bjt_transistor"
import { mosfetTableSpec } from "lib/db/derivedtables/mosfet"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

test("bjt_transistor and mosfet select current JLCPCB subcategories", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (col) => col.primaryKey())
      .addColumn("category", "text", (col) => col.notNull())
      .addColumn("subcategory", "text", (col) => col.notNull())
      .execute()
    await db.schema
      .createTable("components")
      .addColumn("lcsc", "integer", (col) => col.primaryKey())
      .addColumn("category_id", "integer", (col) => col.notNull())
      .addColumn("mfr", "text")
      .addColumn("description", "text")
      .addColumn("stock", "integer")
      .addColumn("price", "text")
      .addColumn("basic", "integer")
      .addColumn("preferred", "integer")
      .addColumn("package", "text")
      .addColumn("extra", "text")
      .execute()

    await db
      .insertInto("categories")
      .values([
        {
          id: 1,
          category: "Transistors",
          subcategory: "Bipolar Transistors - BJT",
        },
        {
          id: 2,
          category: "Transistors/Thyristors",
          subcategory: "Bipolar (BJT)",
        },
        {
          id: 3,
          category: "Transistors/Thyristors",
          subcategory: "MOSFETs",
        },
        {
          id: 4,
          category: "Transistors",
          subcategory: "Dual MOSFETs",
        },
        {
          id: 5,
          category: "Optocoupler",
          subcategory: "Transistor Output Optocoupler",
        },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        {
          lcsc: 7420353,
          category_id: 2,
          mfr: "MMBT3904",
          description:
            "-55℃~+150℃ 1 NPN 100 100nA 200mA 200mW 300MHz 300mV 40V 6V NPN SOT-23 ROHS",
          stock: 6894576,
          price: "1-499:0.0162",
          basic: 0,
          preferred: 1,
          package: "SOT-23",
          extra: JSON.stringify({
            attributes: {
              "Collector - Emitter Voltage VCEO": "40V",
              "Current - Collector(Ic)": "200mA",
              "DC Current Gain": "100",
              "Operating Temperature": "-55℃~+150℃",
              "Pd - Power Dissipation": "200mW",
              "Transition frequency(fT)": "300MHz",
              "Collector Current (Ic)": "null",
              "Collector-Emitter Breakdown Voltage (Vceo)": "null",
              "DC Current Gain (hFE@Ic,Vce)": "100@10mA,1.0V",
              "Power Dissipation (Pd)": "null",
            },
          }),
        },
        {
          lcsc: 2150,
          category_id: 1,
          mfr: "SS8050",
          description: "SOT-23 NPN ROHS",
          stock: 3063033,
          price: "1-499:0.0144",
          basic: 1,
          preferred: 0,
          package: "SOT-23",
          extra: JSON.stringify({
            attributes: {
              "DC Current Gain (hFE@Ic,Vce)": "200@800mA,1V",
              "Current - Collector(Ic)": "1.5A",
              "Collector - Emitter Voltage VCEO": "25V",
              "Pd - Power Dissipation": "300mW",
              "Transition frequency(fT)": "100MHz",
              "Operating Temperature": "-55℃~+150℃@(Tj)",
            },
          }),
        },
        {
          lcsc: 20917,
          category_id: 3,
          mfr: "AO3400A",
          description:
            "-55℃~+150℃ 1 N-channel 1.45V 1.4W 30V 48mΩ@2.5V 5.7A SOT-23 ROHS",
          stock: 1553453,
          price: "1-49:0.0846",
          basic: 1,
          preferred: 0,
          package: "SOT-23",
          extra: JSON.stringify({
            attributes: {
              "Drain Source Voltage (Vdss)": "null",
              "Drain to Source Voltage": "30V",
              "Current - Continuous Drain(Id)": "5.7A",
              "Gate Threshold Voltage (Vgs(th)@Id)": "1.45V@250mA",
              "Pd - Power Dissipation": "1.4W",
              "Operating Temperature": "-55℃~+150℃@(Tj)",
            },
          }),
        },
        {
          lcsc: 8545,
          category_id: 4,
          mfr: "2N7002DW",
          description: "SOT-363 Dual N-Channel ROHS",
          stock: 50000,
          price: "1-99:0.03",
          basic: 0,
          preferred: 0,
          package: "SOT-363",
          extra: JSON.stringify({
            attributes: {
              "Drain to Source Voltage": "60V",
              "Current - Continuous Drain(Id)": "115mA",
              "Gate Threshold Voltage (Vgs(th))": "900mV",
              "Pd - Power Dissipation": "225mW",
              "Operating Temperature": "-40℃~+150℃",
            },
          }),
        },
        {
          lcsc: 999999,
          category_id: 5,
          mfr: "PC817",
          description: "DIP-4 Optocoupler ROHS",
          stock: 1000,
          price: "1-99:0.05",
          basic: 1,
          preferred: 0,
          package: "DIP-4",
          extra: JSON.stringify({ attributes: {} }),
        },
      ])
      .execute()

    await setupDerivedTables({
      db,
      resetAll: true,
      tableNames: ["bjt_transistor", "mosfet"],
    })

    const bjts = await db
      .selectFrom("bjt_transistor")
      .selectAll()
      .orderBy("lcsc", "asc")
      .execute()
    expect(bjts.map((row: any) => row.lcsc)).toEqual([2150, 7420353])
    expect(bjts[0]).toMatchObject({
      lcsc: 2150,
      current_gain: 200,
      collector_current: 1.5,
      collector_emitter_voltage: 25,
      transition_frequency: 100_000_000,
      power_dissipation: 0.3,
      temperature_range: "-55℃~+150℃",
    })
    expect(bjts[1]).toMatchObject({
      lcsc: 7420353,
      current_gain: 100,
      collector_current: 0.2,
      collector_emitter_voltage: 40,
      transition_frequency: 300_000_000,
      power_dissipation: 0.2,
      temperature_range: "-55℃~+150℃",
    })

    const mosfets = await db
      .selectFrom("mosfet")
      .selectAll()
      .orderBy("lcsc", "asc")
      .execute()
    expect(mosfets.map((row: any) => row.lcsc)).toEqual([8545, 20917])
    expect(mosfets[0]).toMatchObject({
      lcsc: 8545,
      drain_source_voltage: 60,
      continuous_drain_current: 0.115,
      gate_threshold_voltage: 0.9,
      power_dissipation: 0.225,
      operating_temp_min: -40,
      operating_temp_max: 150,
      mounting_style: "Surface Mount",
    })
    expect(mosfets[1]).toMatchObject({
      lcsc: 20917,
      drain_source_voltage: 30,
      continuous_drain_current: 5.7,
      gate_threshold_voltage: 1.45,
      power_dissipation: 1.4,
      operating_temp_min: -55,
      operating_temp_max: 150,
      mounting_style: "Surface Mount",
    })
  } finally {
    await db.destroy()
  }
})

test("bjt_transistor and mosfet fall back to description when extra is null", () => {
  const [bjt] = bjtTransistorTableSpec.mapToTable([
    {
      lcsc: 7420357,
      mfr: "MMBT5551",
      description:
        "-55℃~+150℃ 1 NPN 100 100MHz 150mV 160V 300mW 50nA 600mA 6V NPN SOT-23 Bipolar (BJT) ROHS",
      stock: 7240595,
      price: "1-499:0.0122",
      basic: 0,
      preferred: 1,
      package: "SOT-23",
      extra: null,
    } as any,
  ])
  expect(bjt).toMatchObject({
    lcsc: 7420357,
    collector_current: 0.6,
    collector_emitter_voltage: 160,
    transition_frequency: 100_000_000,
    power_dissipation: 0.3,
    temperature_range: "-55℃~+150℃",
  })

  const [mosfet] = mosfetTableSpec.mapToTable([
    {
      lcsc: 2511,
      mfr: "IRFZ44NPBF",
      description: "-55℃~+175℃ 49A 55V 94W N-Channel TO-220 MOSFETs ROHS",
      stock: 41200,
      price: "1-9:0.35",
      basic: 0,
      preferred: 0,
      package: "TO-220",
      extra: null,
    } as any,
  ])
  expect(mosfet).toMatchObject({
    lcsc: 2511,
    drain_source_voltage: 55,
    continuous_drain_current: 49,
    power_dissipation: 94,
    operating_temp_min: -55,
    operating_temp_max: 175,
    mounting_style: "Through Hole",
  })
})
