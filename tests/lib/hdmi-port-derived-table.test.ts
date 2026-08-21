import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { hdmiPortTableSpec } from "lib/db/derivedtables/hdmi-port";
import { setupDerivedTables } from "lib/db/derivedtables/setup-derived-tables";

const makeComponent = (overrides: Record<string, unknown> = {}) =>
  ({
    lcsc: 720616,
    mfr: "HDMI-001S",
    description:
      "19P Female HDMI Horizontal attachment 1 500mA -45℃~+85℃ SMD D-Sub / VGA Connectors ROHS",
    stock: 16120,
    basic: 0,
    preferred: 1,
    price: JSON.stringify([{ qFrom: 1, qTo: null, price: 0.162173913 }]),
    package: "SMD",
    extra: JSON.stringify({
      title: "XUNPU HDMI-001S",
      attributes: {
        "Mounting Style": "Surface Mount",
        "Number of Rows": "1",
        "Current Rating (Max)": "500mA",
        "Operating Temperature Range": "-45℃~+85℃",
        "Number of Pins": "19P",
        "Connector Type": "HDMI",
        Gender: "Female",
      },
    }),
    ...overrides,
  }) as any;

const EXPECTED_INDEX_COLUMNS = [
  "stock",
  "package,stock",
  "mounting_style,stock",
  "orientation,stock",
  "gender,stock",
  "number_of_pins,stock",
  "is_basic,stock",
  "is_preferred,stock",
];

test("HDMI port table maps connector attributes", () => {
  const [port] = hdmiPortTableSpec.mapToTable([makeComponent()]);

  expect(port).toMatchObject({
    lcsc: 720616,
    mfr: "HDMI-001S",
    package: "SMD",
    mounting_style: "Surface Mount",
    orientation: "Horizontal",
    gender: "Female",
    number_of_pins: 19,
    number_of_rows: 1,
    current_rating_a: 0.5,
    operating_temp_min: -45,
    operating_temp_max: 85,
    is_preferred: true,
    price1: 0.162173913,
  });
});

test("HDMI port table excludes neighboring D-Sub connectors", () => {
  const [port] = hdmiPortTableSpec.mapToTable([
    makeComponent({
      mfr: "DS1037-09FNAKT74-0CC",
      description:
        "9P Female D-Sub Bend insert 2 1.5A -40℃~+105℃ Push-Pull D-Sub / VGA Connectors ROHS",
      extra: JSON.stringify({
        attributes: {
          "Connector Type": "D-Sub",
          "Number of Pins": "9P",
          Gender: "Female",
        },
      }),
    }),
  ]);

  expect(port).toBeNull();
});

test("HDMI port table selects dedicated and legacy connector categories", async () => {
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
      .execute();

    await db
      .insertInto("categories")
      .values([
        { id: 1, subcategory: "HDMI Connectors" },
        { id: 2, subcategory: "D-Sub/DVI/HDMI Connectors" },
        { id: 3, subcategory: "Audio & Video Connectors" },
        { id: 4, subcategory: "USB Connectors" },
      ])
      .execute();
    await db
      .insertInto("components")
      .values([
        { lcsc: 1, category_id: 1 },
        { lcsc: 2, category_id: 2 },
        { lcsc: 3, category_id: 3 },
        { lcsc: 4, category_id: 4 },
      ])
      .execute();

    const candidates = await hdmiPortTableSpec
      .listCandidateComponents(db)
      .execute();

    expect(candidates.map((candidate) => candidate.lcsc)).toEqual([1, 2, 3]);
  } finally {
    await db.destroy();
  }
});

test("HDMI port schema and migration create query indexes idempotently", async () => {
  expect(
    hdmiPortTableSpec.indexes?.map((index) => index.columns.join(",")),
  ).toEqual(EXPECTED_INDEX_COLUMNS);

  const database = new Database(":memory:");
  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  });

  try {
    await setupDerivedTables({ db, populate: false });

    const table = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'hdmi_port'",
      )
      .get();
    const indexes = database
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'hdmi_port' AND name NOT LIKE 'sqlite_%'",
      )
      .all();

    expect(table).not.toBeNull();
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length);
  } finally {
    await db.destroy();
  }

  const migrationDatabase = new Database(":memory:");
  const migrationPath = new URL(
    "../../cf-proxy/migrations/0002_hdmi_port.sql",
    import.meta.url,
  );
  const migration = await Bun.file(migrationPath).text();

  try {
    migrationDatabase.exec(migration);
    migrationDatabase.exec(migration);

    const table = migrationDatabase
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'hdmi_port'",
      )
      .get();
    const indexes = migrationDatabase
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'hdmi_port' AND name NOT LIKE 'sqlite_%'",
      )
      .all();

    expect(table).not.toBeNull();
    expect(indexes).toHaveLength(EXPECTED_INDEX_COLUMNS.length);
  } finally {
    migrationDatabase.close();
  }
});
