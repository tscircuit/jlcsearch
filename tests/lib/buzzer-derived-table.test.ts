import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { buzzerTableSpec } from "lib/db/derivedtables/buzzer"

test("buzzers are classified by subcategory across category renames, excluding other audio parts", async () => {
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
      .addColumn("description", "text", (column) => column.notNull())
      .execute()

    await db
      .insertInto("categories")
      .values([
        {
          id: 1,
          category: "Audio Components/Vibration Motors",
          subcategory: "Buzzers",
        },
        {
          id: 2,
          category: "Audio Products / Vibration Motors",
          subcategory: "Buzzers",
        },
        {
          id: 3,
          category: "Audio Products/Micromotors",
          subcategory: "Buzzers",
        },
        {
          id: 4,
          category: "Audio Products/Micromotors",
          subcategory: "Speakers",
        },
        {
          id: 5,
          category: "Audio Products/Micromotors",
          subcategory: "MEMS Microphones",
        },
      ])
      .execute()
    await db
      .insertInto("components")
      .values([
        { lcsc: 1, category_id: 1, description: "" },
        { lcsc: 2, category_id: 2, description: "" },
        { lcsc: 3, category_id: 3, description: "" },
        {
          lcsc: 4,
          category_id: 4,
          description: "Speaker with buzzer in the description",
        },
        { lcsc: 5, category_id: 5, description: "Microphone" },
      ])
      .execute()

    const candidates = await buzzerTableSpec
      .listCandidateComponents(db)
      .execute()

    expect(candidates.map((candidate) => candidate.lcsc)).toEqual([1, 2, 3])
  } finally {
    await db.destroy()
  }
})

test("preserves parts and attributes with missing or malformed optional metadata", () => {
  for (const extra of [
    null,
    "broken",
    JSON.stringify({ attributes: { Type: "Passive" } }),
  ]) {
    const [part] = buzzerTableSpec.mapToTable([
      {
        lcsc: 96033,
        mfr: "MLT-8530",
        description: "",
        package: "SMD",
        stock: 4000,
        basic: 0,
        preferred: 1,
        price: "1-9:0.12,10-:0.1",
        extra,
      } as any,
    ])
    expect(part).toMatchObject({
      lcsc: 96033,
      package: "SMD",
      stock: 4000,
      price1: 0.12,
      is_basic: false,
      is_preferred: true,
      in_stock: true,
      attributes: extra?.startsWith("{") ? { Type: "Passive" } : {},
    })
  }
})
