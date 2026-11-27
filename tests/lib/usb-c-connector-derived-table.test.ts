import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { usbCConnectorTableSpec } from "lib/db/derivedtables/usb_c_connector"

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 2765186,
    mfr: "TYPE-C 16PIN 2MD(073)",
    description:
      "-25℃~+85℃ 1 16P 3A 5,000 times 5V Black Female Surface Mount, Right Angle Type-C SMD USB Connectors ROHS",
    stock: 62_606,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.049565217 }]),
    package: "SMD",
    extra: JSON.stringify({
      attributes: {
        "Connector Type": "Type-C",
        "Mounting Style": "Surface Mount",
        "Current Rating - Power (Max)": "5A",
        "Number of Ports": "1",
        "Number of Contacts": "16P",
        Gender: "Female",
        "Operating Temperature Range": "-25℃~+85℃",
      },
    }),
    ...overrides,
  }) as any

test("maps Type-C female receptacle attributes", () => {
  const [connector] = usbCConnectorTableSpec.mapToTable([makeComponent()])

  expect(connector).toMatchObject({
    lcsc: 2765186,
    mfr: "TYPE-C 16PIN 2MD(073)",
    package: "SMD",
    mounting_style: "Surface Mount",
    current_rating_a: 5,
    number_of_ports: 1,
    number_of_contacts: 16,
    gender: "Female",
    operating_temp_min: -25,
    operating_temp_max: 85,
    is_preferred: true,
    price1: 0.049565217,
  })
})

test("accepts Mother gender, empty descriptions with Type-C attributes, and description-only fallback", () => {
  const components = [
    makeComponent({
      lcsc: 2858274,
      mfr: "TYPE-C 6P CB1.6(073)",
      description:
        "-25℃~+85℃ 1 10,000 Cycles 5A 5V 6P Black Female Laminated board Type-C USB 3.1 SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Mother",
          "Number of Contacts": "6P",
        },
      }),
    }),
    makeComponent({
      lcsc: 48533151,
      mfr: "GT-USB-9013A",
      description: "",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Female",
          "Number of Contacts": "24P",
        },
      }),
    }),
    makeComponent({
      lcsc: 961722,
      mfr: "MC-318",
      description:
        "-30℃~+80℃ 1 10000 times 30V 3A Female Right Angle Type-C USB 3.1 White 插件 USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "-",
        },
      }),
    }),
    makeComponent({
      lcsc: 165948,
      mfr: "TYPE-C-31-M-12",
      description:
        "-30℃~+80℃ 1 10,000 cycles 16P 20V 5A 7.35mm Female Surface Mount, Right Angle Type-C SMD USB Connectors ROHS",
      extra: null,
    }),
  ]

  const mapped = usbCConnectorTableSpec.mapToTable(components)

  expect(mapped.map((row) => row?.lcsc)).toEqual([
    2858274, 48533151, 961722, 165948,
  ])
  expect(mapped.every((row) => row?.gender === "Female")).toBe(true)
})

test("excludes non-Type-C USB connectors and adapters", () => {
  const components = [
    makeComponent({
      lcsc: 456015,
      mfr: "AF 180 ZJB13.7",
      description:
        "-25℃~+85℃ 1 1.5A 13.7mm 30V 4P Female Through Hole Type-A USB 2.0 USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: { "Connector Type": "Type-A", Gender: "Female" },
      }),
    }),
    makeComponent({
      lcsc: 136000,
      mfr: "1050170001",
      description:
        "-30℃~+85℃ 1 10000 times 30V 5P Black Female Micro-B Surface Mount, Right Angle USB 2.0 SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: { "Connector Type": "Micro-B", Gender: "Female" },
      }),
    }),
    makeComponent({
      lcsc: 105424,
      mfr: "920-462A2021S10108",
      description: "5P Black Female Mini-B Surface Mount USB 2.0 SMD",
      extra: null,
    }),
    makeComponent({
      lcsc: 114097,
      mfr: "670688000",
      description: "4P Black Female Type-B USB 2.0 USB Connectors ROHS",
      extra: null,
    }),
    makeComponent({
      lcsc: 999001,
      mfr: "USB-AC-ADAPT",
      description: "Female Type-A to Type-C Adapter USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: { "Connector Type": "Type-C", Gender: "Female" },
      }),
    }),
  ]

  expect(usbCConnectorTableSpec.mapToTable(components)).toEqual([
    null,
    null,
    null,
    null,
    null,
  ])
})

test("excludes male Type-C plugs and connectors with unknown gender", () => {
  const components = [
    makeComponent({
      lcsc: 3151751,
      mfr: "TYPE-C 24P-GTJB 040",
      description:
        "1 20V 24P 3A Black Clamping plate Male Type-C USB 3.1 SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: { "Connector Type": "Type-C", Gender: "Male" },
      }),
    }),
    makeComponent({
      lcsc: 319150,
      mfr: "U261-241N-4BS60",
      description:
        "-40℃~+85℃ 1 10,000 cycles 12.2mm 20V 24P 5A Clamping plate Male Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: { "Connector Type": "Type-C", Gender: "Public" },
      }),
    }),
    makeComponent({
      lcsc: 3039316,
      mfr: "TC-002",
      description:
        "-25℃~+85℃ 1 10,000 cycles 12P 5A 5V Male Surface Mount, Right Angle Type-C USB 3.1 SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: { "Connector Type": "Type-C", Gender: "-" },
      }),
    }),
    makeComponent({
      lcsc: 2688791,
      mfr: "KH-TYPE-C-W.SMT-16P",
      description:
        "-25℃~+85℃ 1 10000 times 16P 3A 5V 7.35mm Surface Mount, Right Angle Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: { "Connector Type": "-", Gender: "-" },
      }),
    }),
  ]

  expect(usbCConnectorTableSpec.mapToTable(components)).toEqual([
    null,
    null,
    null,
    null,
  ])
})

test("setupDerivedTables populates usb_c_connector with Type-C receptacles only", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (column) => column.primaryKey())
      .addColumn("subcategory", "text", (column) => column.notNull())
      .execute()
    await db.schema
      .createTable("components")
      .addColumn("lcsc", "integer", (column) => column.primaryKey())
      .addColumn("category_id", "integer", (column) => column.notNull())
      .addColumn("mfr", "text", (column) => column.notNull())
      .addColumn("description", "text", (column) => column.notNull())
      .addColumn("stock", "integer")
      .addColumn("basic", "integer")
      .addColumn("preferred", "integer")
      .addColumn("price", "text")
      .addColumn("package", "text")
      .addColumn("extra", "text")
      .execute()

    await db
      .insertInto("categories")
      .values([{ id: 1, subcategory: "USB Connectors" }])
      .execute()

    await db
      .insertInto("components")
      .values([
        {
          lcsc: 456015,
          category_id: 1,
          mfr: "AF 180 ZJB13.7",
          description: "Female Through Hole Type-A USB 2.0 USB Connectors ROHS",
          stock: 57_956,
          basic: 0,
          preferred: 0,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.05 }]),
          package: "Plugin",
          extra: JSON.stringify({
            attributes: { "Connector Type": "Type-A", Gender: "Female" },
          }),
        },
        {
          lcsc: 3151751,
          category_id: 1,
          mfr: "TYPE-C 24P-GTJB 040",
          description: "Male Type-C USB 3.1 SMD USB Connectors ROHS",
          stock: 40_610,
          basic: 0,
          preferred: 0,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.08 }]),
          package: "SMD",
          extra: JSON.stringify({
            attributes: { "Connector Type": "Type-C", Gender: "Male" },
          }),
        },
        {
          lcsc: 2765186,
          category_id: 1,
          mfr: "TYPE-C 16PIN 2MD(073)",
          description:
            "16P Female Surface Mount Type-C SMD USB Connectors ROHS",
          stock: 30_000,
          basic: 0,
          preferred: 1,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.05 }]),
          package: "SMD",
          extra: JSON.stringify({
            attributes: {
              "Connector Type": "Type-C",
              Gender: "Female",
              "Number of Contacts": "16P",
            },
          }),
        },
      ])
      .execute()

    await setupDerivedTables({
      db,
      tableNames: ["usb_c_connector"],
    })

    const rows = database
      .query<{ lcsc: number; gender: string }, []>(
        "SELECT lcsc, gender FROM usb_c_connector ORDER BY stock DESC",
      )
      .all()

    expect(rows).toEqual([{ lcsc: 2765186, gender: "Female" }])
  } finally {
    await db.destroy()
  }
})
