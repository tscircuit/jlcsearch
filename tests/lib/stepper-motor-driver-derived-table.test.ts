import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { stepperMotorDriverTableSpec } from "lib/db/derivedtables/stepper-motor-driver"

test("stepper drivers exclude other motor categories even when descriptions are blank", async () => {
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
      .addColumn("description", "text", (column) => column.notNull())
      .execute()

    await db
      .insertInto("categories")
      .values([
        { id: 1, subcategory: "Stepper Motor Driver" },
        { id: 2, subcategory: "Brushed DC Motor Drivers" },
        { id: 3, subcategory: "Brushless DC (BLDC) Motor Driver" },
        { id: 4, subcategory: "Gate Drivers" },
      ])
      .execute()
    await db
      .insertInto("components")
      .values([
        { lcsc: 1, category_id: 1, description: "" },
        { lcsc: 2, category_id: 2, description: "" },
        { lcsc: 3, category_id: 3, description: "" },
        { lcsc: 4, category_id: 4, description: "Gate driver" },
      ])
      .execute()

    const candidates = await stepperMotorDriverTableSpec
      .listCandidateComponents(db)
      .execute()

    expect(candidates.map((candidate) => candidate.lcsc)).toEqual([1])
  } finally {
    await db.destroy()
  }
})

test("preserves parts and attributes with missing or malformed optional metadata", () => {
  for (const extra of [
    null,
    "broken",
    JSON.stringify({ attributes: { Interface: "STEP/DIR" } }),
  ]) {
    const [part] = stepperMotorDriverTableSpec.mapToTable([
      {
        lcsc: 22396981,
        mfr: "FM TC6803S",
        description: "",
        package: "SSOP-24",
        stock: 4000,
        basic: 0,
        preferred: 1,
        price: "1-9:0.12,10-:0.1",
        extra,
      } as any,
    ])
    expect(part).toMatchObject({
      lcsc: 22396981,
      package: "SSOP-24",
      stock: 4000,
      price1: 0.12,
      is_basic: false,
      is_preferred: true,
      in_stock: true,
      attributes: extra?.startsWith("{") ? { Interface: "STEP/DIR" } : {},
    })
  }
})
