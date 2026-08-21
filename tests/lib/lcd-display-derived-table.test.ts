import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { lcdDisplayTableSpec } from "lib/db/derivedtables/lcd_display";

test("lcd display table selects display subcategories when descriptions are blank", async () => {
  const database = new Database(":memory:");
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  });

  try {
    await db.schema
      .createTable("categories")
      .addColumn("id", "integer", (column) => column.primaryKey())
      .addColumn("subcategory", "text", (column) => column.notNull())
      .execute();
    await db.schema
      .createTable("components")
      .addColumn("lcsc", "integer", (column) => column.primaryKey())
      .addColumn("category_id", "integer", (column) => column.notNull())
      .addColumn("description", "text", (column) => column.notNull())
      .execute();

    await db
      .insertInto("categories")
      .values([
        { id: 1, subcategory: "LCD Displays Modules" },
        { id: 2, subcategory: "Liquid Crystal Display Screen" },
        { id: 3, subcategory: "LCD Screen" },
        { id: 4, subcategory: "LCD Drivers" },
      ])
      .execute();
    await db
      .insertInto("components")
      .values([
        { lcsc: 1, category_id: 1, description: "" },
        { lcsc: 2, category_id: 2, description: "" },
        { lcsc: 3, category_id: 3, description: "" },
        { lcsc: 4, category_id: 4, description: "LCD driver" },
      ])
      .execute();

    const candidates = await lcdDisplayTableSpec
      .listCandidateComponents(db)
      .execute();

    expect(candidates.map((candidate) => candidate.lcsc)).toEqual([1, 2, 3]);
  } finally {
    await db.destroy();
  }
});
