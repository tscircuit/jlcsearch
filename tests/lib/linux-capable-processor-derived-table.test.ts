import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { linuxCapableProcessorTableSpec } from "lib/db/derivedtables/linux-capable-processor"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const makeExtra = (manufacturer: unknown, attributes: unknown = {}) =>
  JSON.stringify({ manufacturer, attributes })

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 511448,
    mfr: "STM32MP157AAC3",
    description: "Microcontrollers (MCU/MPU/SOC)",
    stock: 25,
    basic: 0,
    preferred: 1,
    price: "1-9:12.50,10-:11.00",
    package: "LFBGA-361(12x12)",
    source_category: "Embedded Processors & Controllers",
    source_subcategory: "Microcontrollers (MCU/MPU/SOC)",
    extra: makeExtra("STMicroelectronics"),
    ...overrides,
  }) as any

// MPNs and package forms include current JLC catalog entries; stock is a fixture.
const knownParts = [
  ["F1C100S", "Allwinner(全志)", "Allwinner F1C100S", "ARM32", "ARM926EJ-S"],
  ["F1C200S", "Allwinner", "Allwinner F1C200S", "ARM32", "ARM926EJ-S"],
  ["T113-S3", "Allwinner", "Allwinner T113", "ARM32", "Cortex-A7"],
  ["V3S", "Allwinner", "Allwinner V3S", "ARM32", "Cortex-A7"],
  ["A20", "Allwinner", "Allwinner A20", "ARM32", "Cortex-A7"],
  ["A64", "Allwinner", "Allwinner A64", "ARM64", "Cortex-A53"],
  ["H618", "Allwinner", "Allwinner H618", "ARM64", "Cortex-A53"],
  ["T527M00X0DCH", "Allwinner", "Allwinner T527", "ARM64", "Cortex-A55"],
  ["D1-H", "Allwinner", "Allwinner D1", "RISC-V64", "XuanTie C906"],
  ["D1S", "Allwinner", "Allwinner D1", "RISC-V64", "XuanTie C906"],
  ["F133-A", "Allwinner", "Allwinner F133", "RISC-V64", "XuanTie C906"],
  ["RK3288", "Rockchip", "Rockchip RK3288", "ARM32", "Cortex-A17"],
  ["RK3308B", "Rockchip", "Rockchip RK3308", "ARM64", "Cortex-A53"],
  ["RK3399", "Rockchip", "Rockchip RK3399", "ARM64", "Cortex-A72 + Cortex-A53"],
  ["RK3566", "Rockchip", "Rockchip RK3566", "ARM64", "Cortex-A55"],
  ["RK3568B2", "Rockchip", "Rockchip RK3568", "ARM64", "Cortex-A55"],
  [
    "RK3588S",
    "Rockchip",
    "Rockchip RK3588",
    "ARM64",
    "Cortex-A76 + Cortex-A55",
  ],
  ["RV1106G2", "Rockchip", "Rockchip RV1106", "ARM32", "Cortex-A7"],
  ["RV1126", "Rockchip", "Rockchip RV1126", "ARM32", "Cortex-A7"],
  ["RV1126B", "Rockchip", "Rockchip RV1126B", "ARM64", "Cortex-A53"],
  ["STM32MP157AAC3", "STMicroelectronics", "ST STM32MP1", "ARM32", "Cortex-A7"],
  ["STM32MP135DAE7", "STMicroelectronics", "ST STM32MP1", "ARM32", "Cortex-A7"],
  [
    "STM32MP257FAL3",
    "STMicroelectronics",
    "ST STM32MP2",
    "ARM64",
    "Cortex-A35",
  ],
  [
    "MCIMX6Y2CVM08AB",
    "NXP(恩智浦)",
    "NXP i.MX 6UltraLite/ULL",
    "ARM32",
    "Cortex-A7",
  ],
  ["MCIMX6Q5EYM10AD", "Freescale", "NXP i.MX 6", "ARM32", "Cortex-A9"],
  ["MCIMX7D5EVM10SD", "NXP", "NXP i.MX 7", "ARM32", "Cortex-A7"],
  ["MIMX8ML8CVNKZAB", "NXP", "NXP i.MX 8M Plus", "ARM64", "Cortex-A53"],
  ["MIMX9352CVVXMAC", "NXP", "NXP i.MX 93", "ARM64", "Cortex-A55"],
  ["AM3358BZCZA100", "TI(德州仪器)", "TI Sitara AM335x", "ARM32", "Cortex-A8"],
  [
    "AM4378BZDNA100",
    "Texas Instruments",
    "TI Sitara AM437x",
    "ARM32",
    "Cortex-A9",
  ],
  ["AM5718AABCXEA", "TI", "TI Sitara AM57x", "ARM32", "Cortex-A15"],
  ["AM6254ATCGHAALW", "TI", "TI Sitara AM62x", "ARM64", "Cortex-A53"],
  ["AM62A74AUMHAAMBR", "TI", "TI Sitara AM62x", "ARM64", "Cortex-A53"],
  ["AM6442BSFGHAALV", "TI", "TI Sitara AM64x", "ARM64", "Cortex-A53"],
  ["AT91SAM9G20B-CU", "Atmel", "Microchip SAM9", "ARM32", "ARM926EJ-S"],
  ["AT91SAM9260B-CU", "Microchip", "Microchip SAM9", "ARM32", "ARM926EJ-S"],
  ["SAM9X60D1G-I/LZB", "Microchip", "Microchip SAM9", "ARM32", "ARM926EJ-S"],
  ["ATSAMA5D27C-D1G-CU", "Microchip", "Microchip SAMA5", "ARM32", "Cortex-A5"],
  ["ATSAMA5D31A-CU", "ATMEL", "Microchip SAMA5", "ARM32", "Cortex-A5"],
  ["K230D", "Canaan Kendryte", "Canaan K230", "RISC-V64", "XuanTie C908"],
  ["CV1800B", "CVITEK", "SOPHGO CV1800B", "RISC-V64", "XuanTie C906"],
  ["SG2002", "SOPHGO", "SOPHGO SG2002", "RISC-V64", "XuanTie C906"],
] as const

test.each(knownParts)(
  "recognizes Linux processor %s from %s",
  (mfr, manufacturer, chipFamily, architecture, cpuCore) => {
    const [processor] = linuxCapableProcessorTableSpec.mapToTable([
      makeComponent({ mfr, extra: makeExtra(manufacturer) }),
    ])
    expect(processor).toMatchObject({
      manufacturer,
      chip_family: chipFamily,
      architecture,
      cpu_core: cpuCore,
    })
  },
)

test("preserves catalog fields and accepts nested manufacturer metadata", () => {
  const [processor] = linuxCapableProcessorTableSpec.mapToTable([
    makeComponent({
      extra: makeExtra(
        { name: "STMicroelectronics" },
        { "Core Processor": "Cortex-A7 + Cortex-M4", GPIO: 98 },
      ),
    }),
  ])
  expect(processor).toMatchObject({
    lcsc: 511448,
    mfr: "STM32MP157AAC3",
    package: "LFBGA-361(12x12)",
    price1: 12.5,
    in_stock: true,
    is_basic: false,
    is_preferred: true,
    cpu_core: "Cortex-A7",
    attributes: { "Core Processor": "Cortex-A7 + Cortex-M4", GPIO: "98" },
  })
})

test.each([
  ["STM32F407VGT6", "STMicroelectronics"],
  ["STM32H743ZIT6", "STMicroelectronics"],
  ["STM32N657L0H3Q", "STMicroelectronics"],
  ["MIMXRT1176DVMAA", "NXP"],
  ["AM2434BSFFHIALV", "TI"],
  ["AM2634CCZCZRQ1", "TI"],
  ["ESP32-S3", "Espressif"],
  ["ESP32-C6", "Espressif"],
  ["K210", "Canaan"],
  ["CH32V307VCT6", "WCH"],
  ["RK2108", "Rockchip"],
  ["D123", "Allwinner"],
  ["A200", "Allwinner"],
  ["RK3588", "Generic Semiconductor"],
  ["FUTURE-LINUX-PROCESSOR", "Allwinner"],
  ["ATSAMA5D27-SOM1", "Microchip"],
  ["LCKFB-TSPI1F-RK3566-0G-0G", "Rockchip"],
])(
  "excludes MCU, module, unknown or manufacturer collision %s",
  (mfr, manufacturer) => {
    expect(
      linuxCapableProcessorTableSpec.mapToTable([
        makeComponent({
          mfr,
          description: "Linux ARM RISC-V processor",
          extra: makeExtra(manufacturer),
        }),
      ]),
    ).toEqual([null])
  },
)

test.each([
  null,
  "{broken",
  "null",
  "[]",
  "42",
  '"Rockchip"',
  '{"manufacturer":{}}',
])("safely ignores malformed or missing metadata %s", (extra) => {
  expect(
    linuxCapableProcessorTableSpec.mapToTable([makeComponent({ extra })]),
  ).toEqual([null])
})

test("rejects discrete collisions and boards even when manufacturer and part name match", () => {
  for (const overrides of [
    {
      mfr: "SG2002",
      package: "SOT-23",
      description: "transistor",
      extra: makeExtra("SOPHGO"),
    },
    {
      mfr: "D1",
      package: "SOD-123",
      description: "diode",
      extra: makeExtra("Allwinner"),
    },
    { description: "STM32MP157 evaluation board", package: "Module" },
    {
      description: "",
      package: "",
      source_category: "",
      source_subcategory: "",
    },
  ])
    expect(
      linuxCapableProcessorTableSpec.mapToTable([makeComponent(overrides)]),
    ).toEqual([null])
})

test("accepts known processors in old, blank or sourcing categories and malformed attributes", () => {
  for (const attributes of [null, [], "not an object"]) {
    const [processor] = linuxCapableProcessorTableSpec.mapToTable([
      makeComponent({
        description: "",
        source_category: "Others",
        source_subcategory: "",
        extra: makeExtra("STMicroelectronics", attributes),
      }),
    ])
    expect(processor?.attributes).toEqual({})
  }
  const [processor] = linuxCapableProcessorTableSpec.mapToTable([
    makeComponent({
      stock: 0,
      extra: JSON.stringify({ brand: "STMicroelectronics" }),
    }),
  ])
  expect(processor?.in_stock).toBe(false)
})

test("candidate selection includes every fixture across categories but does not scan generic Linux text", async () => {
  const database = new Database(":memory:")
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  try {
    database.exec(
      "CREATE TABLE categories (id INTEGER PRIMARY KEY, category TEXT, subcategory TEXT); CREATE TABLE components (lcsc INTEGER PRIMARY KEY, category_id INTEGER, mfr TEXT, description TEXT, extra TEXT)",
    )
    await db
      .insertInto("categories")
      .values([
        { id: 1, category: "Global Sourcing Parts", subcategory: "" },
        {
          id: 2,
          category: "Single Chip Microcomputer/Microcontroller",
          subcategory: "Microcontroller Units (MCUs/MPUs/SOCs)",
        },
      ])
      .execute()
    await db
      .insertInto("components")
      .values([
        ...knownParts.map(([mfr, manufacturer], index) => ({
          lcsc: index + 1,
          category_id: (index % 2) + 1,
          mfr,
          description: "Processor",
          extra: makeExtra(manufacturer),
        })),
        {
          lcsc: 999,
          category_id: 1,
          mfr: "FUTURE-LINUX-PROCESSOR",
          description: "ARM RISC-V Linux processor",
          extra: makeExtra("Allwinner"),
        },
        {
          lcsc: 1000,
          category_id: 1,
          mfr: "ESP32-C6",
          description: "RISC-V Linux",
          extra: makeExtra("Espressif"),
        },
      ])
      .execute()
    const candidates = await linuxCapableProcessorTableSpec
      .listCandidateComponents(db)
      .execute()
    expect(candidates.map((component) => component.lcsc)).toEqual(
      knownParts.map((_, index) => index + 1),
    )
  } finally {
    await db.destroy()
  }
})

test("SQLite setup and D1 migration create matching columns and indexes idempotently", async () => {
  const database = new Database(":memory:")
  const migrationDatabase = new Database(":memory:")
  const db = new Kysely<any>({ dialect: new BunSqliteDialect({ database }) })
  const schema = (database: Database) => ({
    columns: database
      .query("PRAGMA table_info(linux_capable_processor)")
      .all()
      .map((column: any) => column.name)
      .sort(),
    indexes: database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'linux_capable_processor' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map((index: any) => ({
        name: index.name,
        columns: database
          .query(`PRAGMA index_info('${index.name}')`)
          .all()
          .map((column: any) => column.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  })
  try {
    for (let i = 0; i < 2; i++)
      await setupDerivedTables({
        db,
        populate: false,
        tableNames: ["linux_capable_processor"],
      })
    const migration = await Bun.file(
      new URL(
        "../../cf-proxy/migrations/0009_linux_capable_processor.sql",
        import.meta.url,
      ),
    ).text()
    migrationDatabase.exec(migration)
    migrationDatabase.exec(migration)
    expect(schema(database)).toEqual(schema(migrationDatabase))
    expect(schema(database).indexes).toHaveLength(8)
  } finally {
    await db.destroy()
    migrationDatabase.close()
  }
})
