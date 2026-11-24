import { expect, test } from "bun:test"
import {
  DummyDriver,
  Kysely,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from "kysely"
import { batteryHolderTableSpec } from "lib/db/derivedtables/battery_holder"
import { buzzerTableSpec } from "lib/db/derivedtables/buzzer"
import type { BaseComponent } from "lib/db/derivedtables/component-base"
import {
  createDerivedTableSpec,
  extractBaseComponentFields,
  parseComponentAttributes,
  type SourceComponentRow,
} from "lib/db/derivedtables/create-derived-table-spec"
import { fpcConnectorTableSpec } from "lib/db/derivedtables/fpc_connector"
import { jstConnectorTableSpec } from "lib/db/derivedtables/jst_connector"
import { pcieM2ConnectorTableSpec } from "lib/db/derivedtables/pcie_m2_connector"
import { potentiometerTableSpec } from "lib/db/derivedtables/potentiometer"
import type { KyselyDatabaseInstance } from "lib/db/kysely-types"

const createMockDb = (): KyselyDatabaseInstance =>
  new Kysely({
    dialect: {
      createAdapter: () => new SqliteAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db) => new SqliteIntrospector(db),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  }) as unknown as KyselyDatabaseInstance

const makeSourceComponent = (
  overrides: Partial<SourceComponentRow> = {},
): SourceComponentRow => ({
  lcsc: 123456,
  category_id: 1,
  mfr: "TEST-MPN",
  package: "SMD",
  joints: 2,
  manufacturer_id: 1,
  basic: 1,
  preferred: 0,
  description: "Test component",
  datasheet: "",
  stock: 250,
  price: JSON.stringify([{ qFrom: 1, qTo: 9, price: 0.25 }]),
  last_update: 0,
  extra: JSON.stringify({ attributes: { Key: "Value" } }),
  flag: 0,
  last_on_stock: 0,
  ...overrides,
})

test("parseComponentAttributes handles valid, empty, malformed, and array metadata", () => {
  expect(
    parseComponentAttributes(JSON.stringify({ attributes: { A: "1" } })),
  ).toEqual({ A: "1" })
  expect(parseComponentAttributes(null)).toEqual({})
  expect(parseComponentAttributes("")).toEqual({})
  expect(parseComponentAttributes("{malformed")).toEqual({})
  expect(
    parseComponentAttributes(JSON.stringify({ attributes: ["not-an-object"] })),
  ).toEqual({})
})

test("extractBaseComponentFields maps shared BaseComponent fields consistently", () => {
  const row = makeSourceComponent({
    lcsc: 96033,
    mfr: "MLT-8530",
    description: "Passive Buzzer",
    stock: 100,
    basic: 0,
    preferred: 1,
  })
  const base = extractBaseComponentFields(row)
  expect(base).toEqual({
    lcsc: 96033,
    mfr: "MLT-8530",
    description: "Passive Buzzer",
    stock: 100,
    price1: 0.25,
    in_stock: true,
    is_basic: false,
    is_preferred: true,
    attributes: { Key: "Value" },
  })
})

test("createDerivedTableSpec appends is_basic/is_preferred without duplicates and builds queries", () => {
  interface Demo extends BaseComponent {
    package: string
  }

  const spec = createDerivedTableSpec<Demo>({
    tableName: "demo",
    extraColumns: [
      { name: "package", type: "text" },
      { name: "is_basic", type: "boolean" },
    ],
    indexes: [{ name: "idx_demo_stock", columns: ["stock"] }],
    category: "Passives",
    subcategories: ["Sub A", "Sub B"],
    mapComponent: (c) =>
      c.stock === 0 ? null : { package: String(c.package || "") },
  })

  expect(spec.extraColumns).toEqual([
    { name: "package", type: "text" },
    { name: "is_basic", type: "boolean" },
    { name: "is_preferred", type: "boolean" },
  ])
  expect(spec.indexes).toEqual([{ name: "idx_demo_stock", columns: ["stock"] }])

  const db = createMockDb()
  const compiled = spec.listCandidateComponents(db).compile()
  expect(compiled.sql).toContain('inner join "categories"')
  expect(compiled.sql).toContain('"categories"."category" = ?')
  expect(compiled.sql).toContain('"categories"."subcategory" in (?, ?)')
  expect(compiled.parameters).toEqual(["Passives", "Sub A", "Sub B"])

  const mapped = spec.mapToTable([
    makeSourceComponent({ stock: 10, package: "0402" }),
    makeSourceComponent({ stock: 0, package: "0402" }),
  ])
  expect(mapped).toHaveLength(2)
  expect(mapped[0]?.package).toBe("0402")
  expect(mapped[0]?.is_basic).toBe(true)
  expect(mapped[1]).toBeNull()
})

test("refactored derived table specs preserve table names, columns, indexes, and mappings", () => {
  const db = createMockDb()

  // Buzzer
  expect(buzzerTableSpec.tableName).toBe("buzzer")
  expect(buzzerTableSpec.extraColumns.map((c) => c.name)).toEqual([
    "package",
    "is_basic",
    "is_preferred",
  ])
  expect(buzzerTableSpec.indexes).toHaveLength(2)
  expect(
    buzzerTableSpec.listCandidateComponents(db).compile().parameters,
  ).toEqual(["Buzzers"])
  const [buzzer] = buzzerTableSpec.mapToTable([
    makeSourceComponent({ package: "SMD-8530", extra: "{bad json" }),
  ])
  expect(buzzer?.package).toBe("SMD-8530")
  expect(buzzer?.attributes).toEqual({})

  // PCIe M.2 Connector
  expect(pcieM2ConnectorTableSpec.tableName).toBe("pcie_m2_connector")
  expect(pcieM2ConnectorTableSpec.extraColumns.map((c) => c.name)).toEqual([
    "key",
    "is_right_angle",
    "is_basic",
    "is_preferred",
  ])
  const [m2, m2Null] = pcieM2ConnectorTableSpec.mapToTable([
    makeSourceComponent({
      extra: JSON.stringify({
        attributes: {
          "Interface Form": "M.2-M Key",
          "Mounting Style": "Horizontal",
        },
      }),
    }),
    makeSourceComponent({ extra: null }),
  ])
  expect(m2?.key).toBe("M")
  expect(m2?.is_right_angle).toBe(true)
  expect(m2Null).toBeNull()

  // Potentiometer
  expect(potentiometerTableSpec.tableName).toBe("potentiometer")
  expect(potentiometerTableSpec.extraColumns.map((c) => c.name)).toEqual([
    "max_resistance",
    "pin_variant",
    "package",
    "is_surface_mount",
    "is_basic",
    "is_preferred",
  ])
  const [pot] = potentiometerTableSpec.mapToTable([
    makeSourceComponent({
      package: "SMD",
      extra: JSON.stringify({
        attributes: { Resistance: "10kΩ", "Number of Pins": "3" },
      }),
    }),
  ])
  expect(pot?.max_resistance).toBe(10000)
  expect(pot?.pin_variant).toBe("three_pin")
  expect(pot?.is_surface_mount).toBe(true)

  // FPC Connector
  expect(fpcConnectorTableSpec.tableName).toBe("fpc_connector")
  expect(fpcConnectorTableSpec.extraColumns.map((c) => c.name)).toEqual([
    "pitch_mm",
    "number_of_contacts",
    "contact_type",
    "locking_feature",
    "is_basic",
    "is_preferred",
  ])
  const [fpc] = fpcConnectorTableSpec.mapToTable([
    makeSourceComponent({
      extra: JSON.stringify({
        attributes: {
          Pitch: "0.5mm",
          "Number of Contacts": "24P",
          "Contact Type": "Bottom Contact",
          "Locking Feature": "Flip Lock",
        },
      }),
    }),
  ])
  expect(fpc?.number_of_contacts).toBe(24)
  expect(fpc?.contact_type).toBe("Bottom Contact")
  expect(fpc?.locking_feature).toBe("Flip Lock")

  // JST Connector
  expect(jstConnectorTableSpec.tableName).toBe("jst_connector")
  expect(jstConnectorTableSpec.extraColumns.map((c) => c.name)).toEqual([
    "package",
    "pitch_mm",
    "num_rows",
    "num_pins",
    "reference_series",
    "is_basic",
    "is_preferred",
  ])
  const [jst] = jstConnectorTableSpec.mapToTable([
    makeSourceComponent({
      package: "SH",
      extra: JSON.stringify({
        attributes: {
          Pitch: "1mm",
          "Pins Structure": "1x4",
          "Reference Series": "SH",
        },
      }),
    }),
  ])
  expect(jst?.num_rows).toBe(1)
  expect(jst?.num_pins).toBe(4)
  expect(jst?.reference_series).toBe("SH")

  // Battery Holder
  expect(batteryHolderTableSpec.tableName).toBe("battery_holder")
  expect(batteryHolderTableSpec.extraColumns.map((c) => c.name)).toEqual([
    "package",
    "connector_type",
    "battery_type",
    "operating_temp_min",
    "operating_temp_max",
    "is_basic",
    "is_preferred",
  ])
  const [battery] = batteryHolderTableSpec.mapToTable([
    makeSourceComponent({
      package: "CR2032",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "Battery Holder",
          "Battery Type": "CR2032",
          "Operating Temperature Range": "-20℃~+85℃",
        },
      }),
    }),
  ])
  expect(battery?.battery_type).toBe("CR2032")
  expect(battery?.operating_temp_min).toBe(-20)
  expect(battery?.operating_temp_max).toBe(85)
})
