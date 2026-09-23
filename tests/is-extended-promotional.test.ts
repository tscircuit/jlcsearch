import { test, expect, afterEach, describe } from "bun:test";
import { Database } from "bun:sqlite";
import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildDerivedSyncDatabase } from "../scripts/build-derived-sync-db";

const tempDirectories: string[] = [];

async function createSourceDatabaseWithLibraryType(libraryType: string, lcscId: number) {
  const directory = path.join(os.tmpdir(), `test-${Math.random().toString(36).substring(2, 15)}`);
  await mkdir(directory, { recursive: true });
  tempDirectories.push(directory);

  const sourcePath = path.join(directory, "cache.sqlite3");
  const outputPath = path.join(directory, "db.sqlite3");

  const source = new Database(sourcePath, { create: true });
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
  `);

  source
    .query(
      `INSERT INTO jlc_components (
        lcsc, fetched_at, present, sync_seen, category, subcategory, mfr,
        package, joints, manufacturer, library_type, preferred, last_on_stock,
        description, datasheet, stock, price, attributes
      ) VALUES (
        ?, unixepoch(), 1, 1, 'Connectors',
        'HDMI Connectors', 'HDMI-19P', 'SMD', 19, 'Example', ?, 1,
        unixepoch(), 'HDMI Female 19 Pins', '', 250,
        '1-9:1.25', '{}'
      )`,
    )
    .run(lcscId, libraryType);

  source.close();
  return { sourcePath, outputPath };
}

afterEach(async () => {
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("is_extended_promotional", () => {
  test("correctly parses library_type = 'promotion'", async () => {
    const { sourcePath, outputPath } = await createSourceDatabaseWithLibraryType("promotion", 11111);

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      includeComponentCatalog: true,
      logger: () => {},
    });

    const output = new Database(outputPath, { readonly: true });
    
    // Check component_catalog table
    const catalogRow = output
      .query("SELECT lcsc, basic, is_extended_promotional FROM component_catalog WHERE lcsc = 11111")
      .get() as any;

    expect(catalogRow).toEqual({
      lcsc: 11111,
      basic: 0,
      is_extended_promotional: 1,
    });

    output.close();
  });

  test("correctly parses library_type = 'promotionextend'", async () => {
    const { sourcePath, outputPath } = await createSourceDatabaseWithLibraryType("promotionextend", 22222);

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      includeComponentCatalog: true,
      logger: () => {},
    });

    const output = new Database(outputPath, { readonly: true });
    
    const catalogRow = output
      .query("SELECT lcsc, basic, is_extended_promotional FROM component_catalog WHERE lcsc = 22222")
      .get() as any;

    expect(catalogRow).toEqual({
      lcsc: 22222,
      basic: 0,
      is_extended_promotional: 1,
    });

    output.close();
  });

  test("correctly parses library_type = 'extended_promotional'", async () => {
    const { sourcePath, outputPath } = await createSourceDatabaseWithLibraryType("extended_promotional", 33333);

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      includeComponentCatalog: true,
      logger: () => {},
    });

    const output = new Database(outputPath, { readonly: true });
    
    const catalogRow = output
      .query("SELECT lcsc, basic, is_extended_promotional FROM component_catalog WHERE lcsc = 33333")
      .get() as any;

    expect(catalogRow).toEqual({
      lcsc: 33333,
      basic: 0,
      is_extended_promotional: 1,
    });

    output.close();
  });

  test("does not set is_extended_promotional for library_type = 'base'", async () => {
    const { sourcePath, outputPath } = await createSourceDatabaseWithLibraryType("base", 44444);

    await buildDerivedSyncDatabase({
      sourcePath,
      outputPath,
      includeComponentCatalog: true,
      logger: () => {},
    });

    const output = new Database(outputPath, { readonly: true });
    
    const catalogRow = output
      .query("SELECT lcsc, basic, is_extended_promotional FROM component_catalog WHERE lcsc = 44444")
      .get() as any;

    expect(catalogRow).toEqual({
      lcsc: 44444,
      basic: 1,
      is_extended_promotional: 0,
    });

    output.close();
  });
});
