import { Database } from "bun:sqlite"
import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"
import { usbCConnectorTableSpec } from "lib/db/derivedtables/usb_c_connector"
import { buildDerivedSyncDatabase } from "../../scripts/build-derived-sync-db"

const tempDirectories: string[] = []

afterEach(async () => {
  Bun.gc(true)
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }).catch((error: any) => {
        if (process.platform !== "win32" || error?.code !== "EBUSY") {
          throw error
        }
      }),
    ),
  )
})

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
      title: "SHOU HAN TYPE-C 16PIN 2MD(073)",
      attributes: {
        "Mounting Style": "Surface Mount",
        "Number of Ports": "1",
        "Current Rating - Power (Max)": "5A",
        "Operating Temperature Range": "-25℃~+85℃",
        "Connector Type": "Type-C",
        Standard: "-",
        "Number of Contacts": "16P",
        Gender: "Female",
      },
    }),
    ...overrides,
  }) as any

test("maps USB Type-C female receptacle attributes", () => {
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
    is_basic: false,
    is_preferred: true,
    in_stock: true,
    price1: 0.049565217,
  })
})

test("accepts Mother gender, empty description with Type-C/Female attrs, and Vertical plug mounting style", () => {
  const mapped = usbCConnectorTableSpec.mapToTable([
    makeComponent({
      lcsc: 2927028,
      mfr: "USB-TYPE-C-008",
      description:
        "-25℃~+85℃ 1 10000 times 5A 5V 6.8mm 6P Female Surface Mount, Right Angle Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Mother",
          "Mounting Style": "Horizontal attachment",
          "Current Rating - Power (Max)": "5A",
          "Number of Ports": "1",
          "Number of Contacts": "6P",
          "Operating Temperature Range": "-25℃~+85℃",
        },
      }),
    }),
    makeComponent({
      lcsc: 22383827,
      mfr: "GT-USB-7055BA",
      description: "",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Female",
          "Current Rating-Power": "5A",
          "Mounting Type": "Surface Mount,Vertical",
          "Number of Contacts": "16P",
          "Number of Ports": "1",
          "Operating Temperature": "-40℃~+85℃",
        },
      }),
    }),
    makeComponent({
      lcsc: 3020054,
      mfr: "TYPE-C 16PFS LCH7.45 IPX8",
      description:
        "-35℃~+85℃ 1 10,000 Cycles 16P 3A 5V Black Female Through Hole Type-C USB 3.1 插件 USB Connectors ROHS",
      package: "插件",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Female",
          "Mounting Style": "Vertical plug",
          "Current Rating - Power (Max)": "3A",
          "Number of Contacts": "16P",
          "Number of Ports": "1",
          "Operating Temperature Range": "-35℃~+85℃",
        },
      }),
    }),
    makeComponent({
      lcsc: 309347,
      mfr: "USB-310-B-SU",
      description:
        "-20℃~+60℃ 1 12P 30V 3A 7.35mm Female Surface Mount, Right Angle Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Female",
          "Current Rating - Power (Max)": "3A",
          "Mounting Style": "Horizontal attachment",
          "Number of Contacts": "-",
          "Number of Ports": "1",
          "Operating Temperature Range": "-20℃~+60℃",
        },
      }),
    }),
    makeComponent({
      lcsc: 3197945,
      mfr: "UJ31-CH-G-SMT-TR-67",
      description:
        "-25℃~+85℃ 1 20V 24P 250mA、1.25A、5A Black Female Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Female",
          "Current Rating-Power": "250mA;1.25A;5A",
          "Number of Contacts": "24P",
          "Number of Ports": "1",
          "Operating Temperature": "-25℃~+85℃",
        },
      }),
    }),
    makeComponent({
      lcsc: 48982594,
      mfr: "USB-307-O-SU",
      description:
        "1 24P 7.9mm Female Surface Mount, Right Angle Type-C - USB Connectors ROHS",
      package: "-",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Female",
          "Mounting Type": "Surface Mount, Right Angle",
          "Number of Contacts": "24P",
          "Number of Ports": "1",
          category: { name1: "Connectors", name2: "USB Connectors" },
        },
      }),
    }),
  ])

  expect(mapped[0]).toMatchObject({ lcsc: 2927028, gender: "Female" })
  expect(mapped[1]).toMatchObject({
    lcsc: 22383827,
    gender: "Female",
    current_rating_a: 5,
    mounting_style: "Surface Mount,Vertical",
    operating_temp_min: -40,
    operating_temp_max: 85,
  })
  expect(mapped[2]).toMatchObject({
    lcsc: 3020054,
    gender: "Female",
    mounting_style: "Vertical plug",
  })
  expect(mapped[3]).toMatchObject({
    lcsc: 309347,
    number_of_contacts: 12,
    gender: "Female",
  })
  expect(mapped[4]).toMatchObject({
    lcsc: 3197945,
    current_rating_a: 5,
    number_of_contacts: 24,
    operating_temp_min: -25,
    operating_temp_max: 85,
  })
  expect(mapped[5]).toMatchObject({
    lcsc: 48982594,
    mounting_style: "Surface Mount, Right Angle",
    number_of_contacts: 24,
  })
})

test("accepts female Type-C receptacles when Gender attribute is dash or extra is missing/malformed", () => {
  const mapped = usbCConnectorTableSpec.mapToTable([
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
      lcsc: 2798183,
      mfr: "TYPE-C-14M-015-100",
      description:
        "1 10mm 14P Black Female Through Hole Type-C 插件 USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "-",
          Gender: "-",
        },
      }),
    }),
    makeComponent({
      lcsc: 990001,
      mfr: "USBC-REC-16P",
      description: "USB Type-C receptacle 16P female connector",
      extra: null,
    }),
    makeComponent({
      lcsc: 990002,
      mfr: "TYPEC-6P-F",
      description: "USB-C Socket Female 6P",
      extra: "broken-json",
    }),
  ])

  expect(mapped.map((row) => row?.lcsc)).toEqual([
    961722, 2798183, 990001, 990002,
  ])
  expect(mapped.every((row) => row?.gender === "Female")).toBe(true)
})

test("excludes Type-A, Micro-B, USB-B, Mini-USB, Lightning, and combo adapter connectors", () => {
  const excluded = usbCConnectorTableSpec.mapToTable([
    makeComponent({
      lcsc: 456015,
      mfr: "AF 180 ZJB13.7",
      description:
        "-25℃~+85℃ 1 1.5A 13.7mm 30V 4P 5,000 times Female Through Hole Type-A USB 2.0 White 插件 USB Connectors ROHS",
      package: "插件",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-A",
          Gender: "Female",
        },
      }),
    }),
    makeComponent({
      lcsc: 136000,
      mfr: "1050170001",
      description:
        "-30℃~+85℃ 1 10000 times 30V 5P Black Female Micro-B Surface Mount, Right Angle USB 2.0 SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Micro-B",
          Gender: "Female",
        },
      }),
    }),
    makeComponent({
      lcsc: 105423,
      mfr: "U-B-M9DD-W-1",
      description:
        "-55℃~+85℃ 1 1.8A 18.45mm 9P Blue Female Right Angle Type-B USB 3.0 弯插 USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-B",
          Gender: "Female",
        },
      }),
    }),
    makeComponent({
      lcsc: 990003,
      mfr: "USB-B-REC",
      description: "Female USB-B receptacle",
      extra: null,
    }),
    makeComponent({
      lcsc: 129011,
      mfr: "U-E-M5DD-W-1",
      description:
        "-20℃~+60℃ 1 1A 30V 5,000 times 5P 6.05mm Female Laminated board Micro-AB USB 2.0 SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Micro-AB",
          Gender: "Mother",
        },
      }),
    }),
    makeComponent({
      lcsc: 2904110,
      mfr: "10033526-N3212MLF",
      description:
        "-25℃~+85℃ 1 1A 30V 5P Black Female Mini-B Surface Mount, Right Angle SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Mini-B",
          Gender: "Female",
        },
      }),
    }),
    makeComponent({
      lcsc: 168721,
      mfr: "914-614A2024S10201",
      description:
        "1 10P 7.92mm Black Female Lightning-USB Surface Mount, Right Angle SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Lightning-USB",
          Gender: "Mother",
        },
      }),
    }),
    makeComponent({
      lcsc: 5121968,
      mfr: "917-B88C201AH70202",
      description:
        "-30℃~+85℃ 100V 2 21.5mm 3A 500 times Adapter Black Micro-B、Type-C USB 2.0 - USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Micro-B、Type-C",
          Gender: "Female",
        },
      }),
    }),
  ])

  expect(excluded).toEqual(Array(excluded.length).fill(null))
})

test("excludes male USB-C plugs, Public plugs, adapters, cables, and ambiguous unknown-gender parts", () => {
  const excluded = usbCConnectorTableSpec.mapToTable([
    makeComponent({
      lcsc: 3151751,
      mfr: "TYPE-C 24P-GTJB 040",
      description:
        "1 20V 24P 3A Black Clamping plate Male Type-C USB 3.1 SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Male",
        },
      }),
    }),
    makeComponent({
      lcsc: 530606,
      mfr: "TYPE-C-31-G-02",
      description:
        "-55℃~+85℃ 1 10.7mm 24P 3A Black Clamping plate Male Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "male",
        },
      }),
    }),
    makeComponent({
      lcsc: 319150,
      mfr: "U261-241N-4BS60",
      description:
        "-40℃~+85℃ 1 10,000 cycles 12.2mm 20V 24P 5A Clamping plate Male Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Public",
        },
      }),
    }),
    makeComponent({
      lcsc: 5121978,
      mfr: "917-B88C101AH70205",
      description:
        "-30℃~+85℃ 1 100V 20mm 3A Adapter Type-C - USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Adapter",
        },
      }),
    }),
    makeComponent({
      lcsc: 990004,
      mfr: "CONFLICT-USBC-PLUG",
      description: "24P Male Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "Mother",
        },
      }),
    }),
    makeComponent({
      lcsc: 990005,
      mfr: "USBC-PLUG-24P",
      description: "USB Type-C plug 24P",
      extra: null,
    }),
    makeComponent({
      lcsc: 990006,
      mfr: "USBC-CABLE-1M",
      description: "USB Type-C cable assembly",
      extra: null,
    }),
    makeComponent({
      lcsc: 708961,
      mfr: "917-B88C201AH70201",
      description: "2 20mm Type-C USB 3.1 - USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "-",
        },
      }),
    }),
    makeComponent({
      lcsc: 309334,
      mfr: "USB-309B-B-SU",
      description:
        "-30℃~+80℃ 1 10.68mm 24P 30V 3A Black Clamping plate Type-C SMD USB Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Type-C",
          Gender: "-",
        },
      }),
    }),
  ])

  expect(excluded).toEqual(Array(excluded.length).fill(null))
})

test("setupDerivedTables populates usb_c_connector exclusively with female Type-C receptacles", async () => {
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
      .addColumn("mfr", "text", (column) => column.notNull())
      .addColumn("package", "text", (column) => column.notNull())
      .addColumn("basic", "integer", (column) => column.notNull())
      .addColumn("preferred", "integer", (column) => column.notNull())
      .addColumn("description", "text", (column) => column.notNull())
      .addColumn("stock", "integer")
      .addColumn("price", "text", (column) => column.notNull())
      .addColumn("extra", "text")
      .execute()

    await db
      .insertInto("categories")
      .values([
        { id: 1, category: "Connectors", subcategory: "USB Connectors" },
        { id: 2, category: "Connectors", subcategory: "HDMI Connectors" },
      ])
      .execute()

    await db
      .insertInto("components")
      .values([
        {
          lcsc: 456015,
          category_id: 1,
          mfr: "AF 180 ZJB13.7",
          package: "插件",
          basic: 1,
          preferred: 1,
          description: "Female Through Hole Type-A USB 2.0",
          stock: 57_956,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.04 }]),
          extra: JSON.stringify({
            attributes: { "Connector Type": "Type-A", Gender: "Female" },
          }),
        },
        {
          lcsc: 136000,
          category_id: 1,
          mfr: "1050170001",
          package: "SMD",
          basic: 1,
          preferred: 1,
          description: "Female Micro-B Surface Mount",
          stock: 56_143,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.05 }]),
          extra: JSON.stringify({
            attributes: { "Connector Type": "Micro-B", Gender: "Female" },
          }),
        },
        {
          lcsc: 3151751,
          category_id: 1,
          mfr: "TYPE-C 24P-GTJB 040",
          package: "SMD",
          basic: 1,
          preferred: 1,
          description: "Male Type-C USB 3.1",
          stock: 40_610,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.08 }]),
          extra: JSON.stringify({
            attributes: { "Connector Type": "Type-C", Gender: "Male" },
          }),
        },
        {
          lcsc: 319150,
          category_id: 1,
          mfr: "U261-241N-4BS60",
          package: "SMD",
          basic: 1,
          preferred: 1,
          description: "Male Type-C",
          stock: 9_000,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.09 }]),
          extra: JSON.stringify({
            attributes: { "Connector Type": "Type-C", Gender: "Public" },
          }),
        },
        {
          lcsc: 2681548,
          category_id: 1,
          mfr: "TYPE-C 6P QT073",
          package: "SMD",
          basic: 1,
          preferred: 1,
          description: "6P Black Female Type-C USB 3.1 SMD",
          stock: 30_718,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.03 }]),
          extra: JSON.stringify({
            attributes: {
              "Connector Type": "Type-C",
              Gender: "Female",
              "Number of Contacts": "6P",
            },
          }),
        },
        {
          lcsc: 2927028,
          category_id: 1,
          mfr: "USB-TYPE-C-008",
          package: "SMD",
          basic: 0,
          preferred: 1,
          description: "6P Female Type-C SMD",
          stock: 11_484,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.03 }]),
          extra: JSON.stringify({
            attributes: {
              "Connector Type": "Type-C",
              Gender: "Mother",
              "Number of Contacts": "6P",
            },
          }),
        },
        {
          lcsc: 2765186,
          category_id: 1,
          mfr: "TYPE-C 16PIN 2MD(073)",
          package: "SMD",
          basic: 0,
          preferred: 1,
          description: "16P Female Type-C SMD",
          stock: 10_000,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.05 }]),
          extra: JSON.stringify({
            attributes: {
              "Connector Type": "Type-C",
              Gender: "Female",
              "Number of Contacts": "16P",
            },
          }),
        },
        {
          lcsc: 720616,
          category_id: 2,
          mfr: "HDMI-001S",
          package: "SMD",
          basic: 0,
          preferred: 1,
          description: "19P Female HDMI",
          stock: 16_120,
          price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.16 }]),
          extra: JSON.stringify({
            attributes: { "Connector Type": "HDMI", Gender: "Female" },
          }),
        },
      ])
      .execute()

    await setupDerivedTables({
      db,
      tableNames: ["usb_c_connector"],
      populate: true,
    })

    const rows = database
      .query(
        "SELECT lcsc, mfr, stock, gender, number_of_contacts FROM usb_c_connector ORDER BY stock DESC",
      )
      .all()

    expect(rows).toEqual([
      {
        lcsc: 2681548,
        mfr: "TYPE-C 6P QT073",
        stock: 30_718,
        gender: "Female",
        number_of_contacts: 6,
      },
      {
        lcsc: 2927028,
        mfr: "USB-TYPE-C-008",
        stock: 11_484,
        gender: "Female",
        number_of_contacts: 6,
      },
      {
        lcsc: 2765186,
        mfr: "TYPE-C 16PIN 2MD(073)",
        stock: 10_000,
        gender: "Female",
        number_of_contacts: 16,
      },
    ])
  } finally {
    await db.destroy()
  }
})

test("buildDerivedSyncDatabase builds usb_c_connector without Type-A, Micro-B, USB-B, or male plugs", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "jlcsearch-usbc-sync-"))
  tempDirectories.push(directory)
  const sourcePath = path.join(directory, "source.sqlite3")
  const outputPath = path.join(directory, "derived.sqlite3")
  const source = new Database(sourcePath, { create: true })

  source.exec(`
    CREATE TABLE jlc_components (
      lcsc INTEGER PRIMARY KEY,
      fetched_at INTEGER NOT NULL,
      present INTEGER NOT NULL,
      sync_seen INTEGER NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      mfr TEXT NOT NULL,
      package TEXT NOT NULL,
      joints INTEGER NOT NULL,
      manufacturer TEXT NOT NULL,
      library_type TEXT NOT NULL,
      preferred INTEGER NOT NULL,
      last_on_stock INTEGER NOT NULL,
      description TEXT NOT NULL,
      datasheet TEXT NOT NULL,
      stock INTEGER NOT NULL,
      price TEXT NOT NULL,
      attributes TEXT NOT NULL
    );

    CREATE TABLE lcsc_components (
      lcsc INTEGER PRIMARY KEY,
      fetched_at INTEGER NOT NULL,
      manufacturer TEXT NOT NULL,
      attributes TEXT NOT NULL,
      image TEXT,
      url_slug TEXT
    );
  `)

  const insertJlc = source.prepare(`
    INSERT INTO jlc_components (
      lcsc, fetched_at, present, sync_seen, category, subcategory, mfr,
      package, joints, manufacturer, library_type, preferred, last_on_stock,
      description, datasheet, stock, price, attributes
    ) VALUES (
      ?, unixepoch(), 1, 1, 'Connectors', 'USB Connectors', ?,
      ?, 16, 'Example', 'base', 1, unixepoch(),
      ?, '', ?, '1-:0.05', ?
    )
  `)
  const insertLcsc = source.prepare(`
    INSERT INTO lcsc_components (
      lcsc, fetched_at, manufacturer, attributes, image, url_slug
    ) VALUES (?, unixepoch(), 'Example', ?, NULL, 'example')
  `)

  insertJlc.run(
    456015,
    "AF 180 ZJB13.7",
    "插件",
    "Female Through Hole Type-A USB 2.0",
    57_956,
    JSON.stringify({ "Connector Type": "Type-A" }),
  )
  insertLcsc.run(456015, JSON.stringify({ Gender: "Female" }))

  insertJlc.run(
    136000,
    "1050170001",
    "SMD",
    "Female Micro-B Surface Mount",
    56_143,
    JSON.stringify({ "Connector Type": "Micro-B" }),
  )
  insertLcsc.run(136000, JSON.stringify({ Gender: "Female" }))

  insertJlc.run(
    105423,
    "U-B-M9DD-W-1",
    "弯插",
    "Female Right Angle Type-B USB 3.0",
    666,
    JSON.stringify({ "Connector Type": "Type-B" }),
  )
  insertLcsc.run(105423, JSON.stringify({ Gender: "Female" }))

  insertJlc.run(
    3151751,
    "TYPE-C 24P-GTJB 040",
    "SMD",
    "Male Type-C USB 3.1",
    40_610,
    JSON.stringify({ "Connector Type": "Type-C" }),
  )
  insertLcsc.run(3151751, JSON.stringify({ Gender: "Male" }))

  insertJlc.run(
    2681548,
    "TYPE-C 6P QT073",
    "SMD",
    "6P Black Female Type-C USB 3.1 SMD",
    30_718,
    JSON.stringify({ "Connector Type": "Type-C", "Number of Contacts": "6P" }),
  )
  insertLcsc.run(2681548, JSON.stringify({ Gender: "Female" }))

  insertJlc.run(
    2909610,
    "TYPEC-304A-ACP16O",
    "SMD",
    "16P Female Type-C SMD",
    12_844,
    JSON.stringify({
      "Connector Type": "Type-C",
      "Number of Contacts": "16P",
    }),
  )
  insertLcsc.run(2909610, JSON.stringify({ Gender: "Female" }))

  source.close()

  await buildDerivedSyncDatabase({
    sourcePath,
    outputPath,
    tableNames: ["usb_c_connector"],
    logger: () => {},
  })

  const output = new Database(outputPath, { readonly: true })
  try {
    const rows = output
      .query(
        "SELECT lcsc, mfr, stock, gender, number_of_contacts FROM usb_c_connector ORDER BY stock DESC",
      )
      .all()

    expect(rows).toEqual([
      {
        lcsc: 2681548,
        mfr: "TYPE-C 6P QT073",
        stock: 30_718,
        gender: "Female",
        number_of_contacts: 6,
      },
      {
        lcsc: 2909610,
        mfr: "TYPEC-304A-ACP16O",
        stock: 12_844,
        gender: "Female",
        number_of_contacts: 16,
      },
    ])
  } finally {
    output.close()
  }
})
