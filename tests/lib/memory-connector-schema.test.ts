import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import {
  dimmConnectorTableSpec,
  sodimmConnectorTableSpec,
} from "lib/db/derivedtables/memory-connector";
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables";

const EXPECTED_INDEX_COLUMNS = [
  "stock",
  "package,stock",
  "ddr_standard,stock",
  "num_pins,stock",
  "pitch_mm,stock",
  "height_above_board_mm,stock",
  "mounting_type,stock",
  "is_right_angle,stock",
  "is_basic,stock",
  "is_preferred,stock",
];

test("memory connector derived table specs declare their query indexes", () => {
  for (const spec of [dimmConnectorTableSpec, sodimmConnectorTableSpec]) {
    expect(spec.indexes?.map((index) => index.columns.join(","))).toEqual(
      EXPECTED_INDEX_COLUMNS,
    );
  }
});

test("derived table setup creates memory connector tables and indexes", async () => {
  const database = new Database(":memory:");
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  });

  try {
    await setupDerivedTables({ db, populate: false });

    for (const tableName of ["dimm_connector", "sodimm_connector"]) {
      const table = database
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(tableName);
      const indexes = database
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_%'",
        )
        .all(tableName);

      expect(table).not.toBeNull();
      expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length);
    }
  } finally {
    await db.destroy();
  }
});

test("D1 migration creates both memory connector schemas idempotently", async () => {
  const database = new Database(":memory:");
  const migrationPath = new URL(
    "../../cf-proxy/migrations/0001_memory_connector_tables.sql",
    import.meta.url,
  );
  const migration = await Bun.file(migrationPath).text();

  try {
    database.exec(migration);
    database.exec(migration);

    const tables = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('dimm_connector', 'sodimm_connector') ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('dimm_connector', 'sodimm_connector') AND name NOT LIKE 'sqlite_%'",
      )
      .all();

    expect(tables.map((table) => table.name)).toEqual([
      "dimm_connector",
      "sodimm_connector",
    ]);
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length * 2);
  } finally {
    database.close();
  }
});
