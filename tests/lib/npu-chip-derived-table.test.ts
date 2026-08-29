import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { npuChipTableSpec } from "lib/db/derivedtables/npu-chip"
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables"

const makeExtra = (
  manufacturer: string | Record<string, unknown>,
  attributes: Record<string, unknown> = {},
) => JSON.stringify({ manufacturer, attributes })

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 22_364_189,
    mfr: "RK3588J",
    description: "Microcontrollers (MCU/MPU/SOC)",
    stock: 156,
    basic: 0,
    preferred: 1,
    price: "1-2:91.8475,3-:87.2969",
    package: "FCBGA-1088L(23x23)",
    source_category: "Embedded Processors & Controllers",
    source_subcategory: "Microcontrollers (MCU/MPU/SOC)",
    extra: makeExtra("Rockchip", { "NPU Performance": "6 TOPS" }),
    ...overrides,
  }) as any

const KNOWN_FAMILY_CASES = [
  ["RK1808", "Rockchip", "Rockchip RK1808", "Rockchip NPU"],
  ["RK3399Pro", "Rockchip", "Rockchip RK3399Pro", "Rockchip NPU"],
  ["RK3562", "Rockchip", "Rockchip RK3562", "Rockchip NPU"],
  ["RK3566", "Rockchip", "Rockchip RK3566", "Rockchip NPU"],
  ["RK3568J", "Rockchip", "Rockchip RK3568", "Rockchip NPU"],
  ["RK3576", "Rockchip", "Rockchip RK3576", "Rockchip NPU"],
  ["RK3588S", "Rockchip", "Rockchip RK3588", "Rockchip NPU"],
  ["RV1103B", "Rockchip", "Rockchip RV1103", "Rockchip NPU"],
  ["RV1106G2", "Rockchip", "Rockchip RV1106", "Rockchip NPU"],
  ["RV1109", "Rockchip", "Rockchip RV1109", "Rockchip NPU"],
  ["RV1126", "Rockchip", "Rockchip RV1126", "Rockchip NPU"],
  ["V831", "Allwinner", "Allwinner V831", "NPU"],
  ["V833", "Allwinner", "Allwinner V833", "NPU"],
  ["V851S", "Allwinner", "Allwinner V851S", "NPU"],
  ["V851SE", "Allwinner", "Allwinner V851SE", "NPU"],
  ["V853", "Allwinner", "Allwinner V853", "NPU"],
  ["V853S", "Allwinner", "Allwinner V853S", "NPU"],
  ["R329-N3", "Allwinner", "Allwinner R329-N3", "Zhouyi Z1 AIPU", 0.25],
  ["R329-N4", "Allwinner", "Allwinner R329-N4", "Zhouyi Z1 AIPU", 0.25],
  ["T527M00X0DCH", "Allwinner(全志)", "Allwinner T527", "NPU", 2],
  ["MIMX8ML8CVNKZAB", "NXP Semicon", "NXP i.MX 8M Plus", "NPU"],
  ["MIMX9352CVVXMAC", "NXP(恩智浦)", "NXP i.MX 93", "Arm Ethos-U65", 0.5],
  ["MCXN247VDF", "NXP", "NXP MCXN247", "eIQ Neutron"],
  ["MCXN526VDF", "NXP", "NXP MCXN526", "eIQ Neutron"],
  ["MCXN527VNL", "NXP", "NXP MCXN527", "eIQ Neutron"],
  ["MCXN536VDF", "NXP", "NXP MCXN536", "eIQ Neutron"],
  ["MCXN537VNL", "NXP", "NXP MCXN537", "eIQ Neutron"],
  ["MCXN546VDFT", "NXP", "NXP MCXN546", "eIQ Neutron"],
  ["MCXN547VKLT", "NXP", "NXP MCXN547", "eIQ Neutron"],
  ["MCXN946VDF", "NXP", "NXP MCXN946", "eIQ Neutron"],
  ["MCXN947VKLT", "NXP", "NXP MCXN947", "eIQ Neutron"],
  ["STM32N657L0H3Q", "STMicroelectronics", "ST STM32N657", "Neural-ART"],
  ["STM32MP257FAI3", "STMicroelectronics", "ST STM32MP257", "VeriSilicon NPU"],
  ["STM32MP255FAK3", "STMicroelectronics", "ST STM32MP255", "VeriSilicon NPU"],
  ["STM32MP255DAK3", "JLCPCB Assembly", "ST STM32MP255", "VeriSilicon NPU"],
  ["HX6538-A", "Himax", "Himax HX6538", "Ethos-U55"],
  ["A311D", "Amlogic", "Amlogic A311D", "NPU"],
  ["A311D2", "Amlogic", "Amlogic A311D2", "NPU"],
  ["C308X", "Amlogic", "Amlogic C308X", "NPU"],
  ["K210", "Canaan Kendryte", "Canaan K210", "KPU"],
  ["K230", "Canaan", "Canaan K230", "KPU"],
  ["K230D", "Canaan", "Canaan K230D", "KPU"],
  ["CV1800B", "CVITEK", "SOPHGO CV1800B", "TPU"],
  ["CV180ZB", "SOPHGO", "SOPHGO CV180ZB", "TPU"],
  ["CV1812H", "CVITEK", "SOPHGO CV181x", "TPU"],
  ["CV1822", "CVITEK", "SOPHGO CV182x", "TPU"],
  ["CV1835", "SOPHGO", "SOPHGO CV1835", "TPU"],
  ["CV1838", "SOPHGO", "SOPHGO CV1838", "TPU"],
  ["SG2002", "SOPHGO", "SOPHGO SG2002", "TPU"],
  ["R9A07G054L23GBG", "Renesas", "Renesas RZ/V2L", "DRP-AI", 0.5],
  ["MAX78000EXG+", "Analog Devices", "ADI MAX78000", "CNN accelerator"],
  ["MAX78002EXG+", "Maxim Integrated", "ADI MAX78002", "CNN accelerator"],
  ["AX620A", "Axera", "Axera AX620A", "AXNeutron"],
  ["AX630A", "Axera", "Axera AX630A", "AXNeutron"],
  ["AX630C", "Axera", "Axera AX630C", "AXNeutron"],
  ["SSC338Q", "SigmaStar", "SigmaStar SSC338Q", "DLA"],
  ["TDA4VM88TGCALFRQ1", "TI(德州仪器)", "TI TDA4VM", "C7x NPU (MMA)", 8],
  [
    "TDA4AH88TGAALYRQ1",
    "Texas Instruments",
    "TI TDA4AH",
    "C7x NPU (MMAv2)",
    32,
  ],
  ["TDA4VEN8K5AAMWRQ1", "TI(德州仪器)", "TI TDA4VEN", "C7x NPU (MMA)", 4],
  ["TDA4AEN8J5AAMWRQ1", "TI(德州仪器)", "TI TDA4AEN", "C7x NPU (MMA)", 4],
  ["AM62A74AUMHAAMBR", "TI(德州仪器)", "TI AM62A7", "C7x NPU (MMA)", 2],
  ["AM62A34ASMSIAMBRQ1", "TI(德州仪器)", "TI AM62A3", "C7x NPU (MMA)", 1],
  ["AM69A98ATGGHAALYR", "TI(德州仪器)", "TI AM69A", "C7x NPU (MMAv2)", 32],
] as const

test("NPU chip table recognizes every curated manufacturer-gated family", () => {
  for (const [
    mfr,
    manufacturer,
    chipFamily,
    npuName,
    performanceTops,
  ] of KNOWN_FAMILY_CASES) {
    const [chip] = npuChipTableSpec.mapToTable([
      makeComponent({
        mfr,
        extra: makeExtra(manufacturer),
      }),
    ])

    expect(
      chip,
      `expected ${manufacturer} ${mfr} to be classified`,
    ).not.toBeNull()
    expect(chip).toMatchObject({
      manufacturer,
      chip_family: chipFamily,
      npu_name: npuName,
      npu_performance_tops: performanceTops ?? null,
    })
  }
})

test("NPU chip table maps base fields and explicit TOPS metadata", () => {
  const [chip] = npuChipTableSpec.mapToTable([
    makeComponent({
      extra: makeExtra(
        { name: "Rockchip" },
        {
          Accelerator: "RKNN",
          "NPU Performance": "6 TOPS INT8",
        },
      ),
    }),
  ])

  expect(chip).toMatchObject({
    lcsc: 22_364_189,
    mfr: "RK3588J",
    stock: 156,
    price1: 91.8475,
    in_stock: true,
    is_basic: false,
    is_preferred: true,
    package: "FCBGA-1088L(23x23)",
    manufacturer: "Rockchip",
    chip_family: "Rockchip RK3588",
    npu_name: "Rockchip NPU",
    npu_performance_tops: 6,
  })
})

test("NPU performance converts GOPS to TOPS and remains nullable", () => {
  const [withGops] = npuChipTableSpec.mapToTable([
    makeComponent({
      mfr: "MAX78000EXG+",
      extra: makeExtra("Analog Devices", {
        "CNN Accelerator Performance": "500 GOPS",
      }),
    }),
  ])
  const [withoutPerformance] = npuChipTableSpec.mapToTable([
    makeComponent({ extra: makeExtra("Rockchip") }),
  ])

  expect(withGops?.npu_performance_tops).toBe(0.5)
  expect(withoutPerformance?.npu_performance_tops).toBeNull()
})

test.each([
  ["NPU", "NPU"],
  ["neural processing unit", "NPU"],
  ["neural accelerator", "Neural accelerator"],
  ["neural network accelerator", "Neural accelerator"],
  ["neural network hardware accelerator", "Neural accelerator"],
  ["KPU", "KPU"],
  ["TPU", "TPU"],
  ["DRP-AI", "DRP-AI"],
  ["AIPU", "AIPU"],
  ["CNN accelerator", "CNN accelerator"],
  ["DLA", "DLA"],
  ["Ethos-U55", "Ethos-U55"],
  ["Ethos-U65", "Arm Ethos-U65"],
  ["Neural-ART", "Neural-ART"],
  ["eIQ Neutron", "eIQ Neutron"],
  ["AXNeutron", "AXNeutron"],
  ["RKNN", "RKNN"],
])("semantic evidence recognizes exact %s aliases", (alias, expectedName) => {
  const [chip] = npuChipTableSpec.mapToTable([
    makeComponent({
      mfr: "FUTURE-NPU-1",
      extra: makeExtra("Future Silicon", { Accelerator: alias }),
    }),
  ])

  expect(chip?.npu_name).toBe(expectedName)
  expect(chip?.chip_family).toBe("FUTURE-NPU-1")
})

test.each([
  ["K210", "Canaan", "SOD-123", "100V Schottky diode", {}],
  ["RK3399", "Rockchip", "BGA-453", "Processor", { Accelerator: "NPU" }],
  ["STM32N655L0", "STMicroelectronics", "BGA-223", "MCU", { NPU: "Yes" }],
  ["ESP32-S3", "Espressif", "QFN-56", "MCU", { NPU: "Yes" }],
  ["R9A07G044", "Renesas", "BGA-456", "Processor", { Accelerator: "DRP-AI" }],
  ["MIMX9322CVUXMAB", "NXP(恩智浦)", "VFBGA-396", "Processor", {}],
  ["AM6254ATCGHAALW", "TI(德州仪器)", "FCBGA-425", "Processor", {}],
  ["AM6958ATGGHAALYR", "TI(德州仪器)", "FCBGA-1414", "Processor", {}],
  ["TDA4X-NON-NPU", "TI(德州仪器)", "FCBGA-827", "Processor", {}],
  ["ECK32-T527", "Allwinner(全志)", "Module", "Development board", {}],
  ["SG2002", "SOPHGO", "SOT-23", "Small-signal transistor", { TPU: "Yes" }],
  [
    "INPUT-CONTROLLER",
    "Rockchip",
    "BGA-100",
    "Input controller",
    { Signal: "Input" },
  ],
  [
    "NETWORK-ASIC",
    "Rockchip",
    "BGA-100",
    "Network processing unit (NPU)",
    { Type: "network processing unit" },
  ],
  ["RK3588", "Generic Semiconductor", "BGA-1088", "Processor", { NPU: "Yes" }],
])(
  "does not classify false positive %s",
  (mfr, manufacturer, packageName, description, attributes) => {
    const [chip] = npuChipTableSpec.mapToTable([
      makeComponent({
        mfr,
        package: packageName,
        description,
        extra: makeExtra(manufacturer, attributes),
      }),
    ])

    expect(chip).toBeNull()
  },
)

test("candidate selector covers family MPNs and exact semantics without matching Input", async () => {
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
      .addColumn("description", "text", (column) => column.notNull())
      .addColumn("extra", "text")
      .execute()
    await db
      .insertInto("categories")
      .values({
        id: 1,
        category: "Embedded Processors & Controllers",
        subcategory: "Microcontrollers (MCU/MPU/SOC)",
      })
      .execute()
    await db
      .insertInto("components")
      .values([
        {
          lcsc: 1,
          category_id: 1,
          mfr: "RK3588J",
          description: "Processor",
          extra: makeExtra("Rockchip"),
        },
        {
          lcsc: 2,
          category_id: 1,
          mfr: "FUTURE-AI-1",
          description: "Processor",
          extra: makeExtra("Rockchip", { Accelerator: "NPU" }),
        },
        {
          lcsc: 3,
          category_id: 1,
          mfr: "INPUT-CONTROLLER",
          description: "Input controller",
          extra: makeExtra("Rockchip", { Signal: "Input" }),
        },
        {
          lcsc: 4,
          category_id: 1,
          mfr: "K210",
          description: "Schottky diode",
          extra: makeExtra("Canaan"),
        },
        {
          lcsc: 5,
          category_id: 1,
          mfr: "RK3399",
          description: "Processor",
          extra: makeExtra("Rockchip"),
        },
      ])
      .execute()

    const candidates = await npuChipTableSpec
      .listCandidateComponents(db)
      .execute()

    expect(candidates.map((candidate) => candidate.lcsc)).toEqual([1, 2, 4])
  } finally {
    await db.destroy()
  }
})

const EXPECTED_INDEX_COLUMNS = [
  "stock",
  "package,stock",
  "manufacturer,stock",
  "chip_family,stock",
  "npu_name,stock",
  "npu_performance_tops,stock",
  "is_basic,stock",
  "is_preferred,stock",
]

test("NPU chip schema creates query indexes idempotently", async () => {
  expect(
    npuChipTableSpec.indexes?.map((index) => index.columns.join(",")),
  ).toEqual(EXPECTED_INDEX_COLUMNS)

  const database = new Database(":memory:")
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })

  try {
    await setupDerivedTables({
      db,
      populate: false,
      tableNames: ["npu_chip"],
    })
    await setupDerivedTables({
      db,
      populate: false,
      tableNames: ["npu_chip"],
    })

    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'npu_chip' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    await db.destroy()
  }

  const migrationDatabase = new Database(":memory:")
  const migration = await Bun.file(
    new URL("../../cf-proxy/migrations/0008_npu_chip.sql", import.meta.url),
  ).text()
  try {
    migrationDatabase.exec(migration)
    migrationDatabase.exec(migration)
    const indexes = migrationDatabase
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'npu_chip' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length)
  } finally {
    migrationDatabase.close()
  }
})
