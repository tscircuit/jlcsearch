import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { Kysely } from "kysely"
import { BunSqliteDialect } from "kysely-bun-sqlite"
import { chmod, mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { queryComponentCatalog } from "../cf-proxy/src/components"
import { searchIndex } from "../cf-proxy/src/search"

async function installFakeWrangler(
  tempDirectory: string,
  databasePath: string,
) {
  const fakeBinDirectory = path.join(tempDirectory, "bin")
  const fakeWranglerPath = path.join(tempDirectory, "fake-wrangler.ts")
  const fakeBunxPath = path.join(fakeBinDirectory, "bunx")
  await mkdir(fakeBinDirectory, { recursive: true })

  await Bun.write(
    fakeWranglerPath,
    `
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"

const args = Bun.argv.slice(2)
if (args[0] !== "wrangler" || args[1] !== "d1" || args[2] !== "execute") {
  throw new Error(\`Unexpected command: \${args.join(" ")}\`)
}

const commandIndex = args.indexOf("--command")
const fileEqualsArg = args.find((arg) => arg.startsWith("--file="))
const fileIndex = args.indexOf("--file")
const sql =
  commandIndex >= 0
    ? args[commandIndex + 1]
    : fileEqualsArg
      ? readFileSync(fileEqualsArg.slice("--file=".length), "utf8")
      : fileIndex >= 0
        ? readFileSync(args[fileIndex + 1], "utf8")
        : null

if (!sql) throw new Error(\`Missing SQL in command: \${args.join(" ")}\`)

const database = new Database(process.env.FAKE_D1_PATH!)
try {
  if (args.includes("--json")) {
    console.log(JSON.stringify([{ results: database.query(sql).all() }]))
  } else {
    database.exec(sql)
    console.log(JSON.stringify([{ results: [] }]))
  }
} finally {
  database.close()
}
`.trim(),
  )
  await Bun.write(
    fakeBunxPath,
    `#!/usr/bin/env bash\n"${process.execPath}" "${fakeWranglerPath}" "$@"\n`,
  )
  await chmod(fakeBunxPath, 0o755)

  return fakeBinDirectory
}

async function runShellScript(
  scriptPath: string,
  fakeBinDirectory: string,
  databasePath: string,
  env: Record<string, string> = {},
) {
  const script = Bun.spawn({
    cmd: ["bash", scriptPath],
    cwd: path.resolve(import.meta.dir, ".."),
    env: {
      ...process.env,
      ...env,
      DB_NAME: "test",
      FAKE_D1_PATH: databasePath,
      PATH: `${fakeBinDirectory}:${process.env.PATH ?? ""}`,
      RETRY_MAX_ATTEMPTS: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    script.exited,
    new Response(script.stdout).text(),
    new Response(script.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

test("search index materializes and filters extended promotional parts", async () => {
  const database = new Database(":memory:")
  database.exec(`
    CREATE TABLE component_catalog (
      lcsc INTEGER NOT NULL UNIQUE,
      category TEXT,
      subcategory TEXT,
      mfr TEXT,
      package TEXT,
      basic INTEGER,
      preferred INTEGER,
      is_extended_promotional INTEGER,
      description TEXT,
      stock INTEGER,
      price TEXT,
      extra TEXT
    );

    INSERT INTO component_catalog (
      lcsc, category, subcategory, mfr, package, basic, preferred,
      is_extended_promotional, description, stock, price, extra
    ) VALUES
      (1001, 'Connectors', 'HDMI', 'HDMI-BASE', 'SMD', 1, 1, 0,
       'Base HDMI part', 100, '1-:1.25', '{}'),
      (1002, 'Connectors', 'HDMI', 'HDMI-EXT', 'SMD', 0, 1, 1,
       'Extended promotional HDMI part', 200, '1-:1.50', '{}'),
      (1003, 'Connectors', 'HDMI', 'HDMI-REGULAR-EXT', 'SMD', 0, 0, 0,
       'Regular extended HDMI part', 150, '1-:1.75', '{}');
  `)

  const rebuildScript = await Bun.file(
    new URL(
      "../cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
      import.meta.url,
    ),
  ).text()
  database.exec(rebuildScript)

  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database }),
  })
  const searchDb = db as unknown as Parameters<typeof searchIndex>[0]

  try {
    const rows = await searchIndex(searchDb, {
      is_extended_promotional: "true",
    })
    expect(rows.map((row) => row.lcsc)).toEqual([1002])
    expect(rows[0]).toMatchObject({ is_extended_promotional: 1 })

    const numericRows = await searchIndex(searchDb, {
      is_extended_promotional: "1",
    })
    expect(numericRows.map((row) => row.lcsc)).toEqual([1002])

    const catalogRows = await queryComponentCatalog(searchDb, {
      is_extended_promotional: "true",
    })
    expect(catalogRows.map((row) => row.lcsc)).toEqual([1002])

    expect(
      database
        .query(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'index'
             AND name = 'idx_search_index_extended_promotional_stock'`,
        )
        .get(),
    ).toEqual({ name: "idx_search_index_extended_promotional_stock" })
  } finally {
    await db.destroy()
    database.close()
  }
})

test("fresh D1 migrations leave catalog creation to full catalog bootstrap", async () => {
  const database = new Database(":memory:")
  const migrationFiles = (
    await readdir(new URL("../cf-proxy/migrations", import.meta.url))
  )
    .filter((file) => file.endsWith(".sql"))
    .sort()

  try {
    for (const migrationFile of migrationFiles) {
      const migration = await Bun.file(
        new URL(`../cf-proxy/migrations/${migrationFile}`, import.meta.url),
      ).text()
      database.exec(migration)
    }

    expect(
      database
        .query(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'table'
             AND name IN ('component_catalog', 'search_index')
           ORDER BY name`,
        )
        .all(),
    ).toEqual([])

    database.exec(`
      CREATE TABLE component_catalog (
        lcsc INTEGER NOT NULL UNIQUE,
        category TEXT,
        subcategory TEXT,
        mfr TEXT,
        package TEXT,
        basic INTEGER,
        preferred INTEGER,
        is_extended_promotional INTEGER,
        description TEXT,
        stock INTEGER,
        price TEXT,
        extra TEXT
      );

      INSERT INTO component_catalog (
        lcsc, category, subcategory, mfr, package, basic, preferred,
        is_extended_promotional, description, stock, price, extra
      ) VALUES
        (1101, 'Connectors', 'HDMI', 'HDMI-BASE', 'SMD', 1, 1, 0,
         'Base HDMI part', 100, '1-:1.25', '{}'),
        (1102, 'Connectors', 'HDMI', 'HDMI-EXT', 'SMD', 0, 1, 1,
         'Extended promotional HDMI part', 200, '1-:1.50', '{}'),
        (1103, 'Connectors', 'HDMI', 'HDMI-REGULAR-EXT', 'SMD', 0, 0, 0,
         'Regular extended HDMI part', 150, '1-:1.75', '{}');
    `)

    const rebuildScript = await Bun.file(
      new URL(
        "../cf-proxy/scripts/rebuild-search-index-from-component-catalog.sql",
        import.meta.url,
      ),
    ).text()
    database.exec(rebuildScript)

    const db = new Kysely<any>({
      dialect: new BunSqliteDialect({ database }),
    })
    const searchDb = db as unknown as Parameters<typeof searchIndex>[0]

    try {
      const rows = await searchIndex(searchDb, {
        is_extended_promotional: "true",
      })
      expect(rows.map((row) => row.lcsc)).toEqual([1102])
      expect(
        database
          .query(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'index'
               AND name = 'idx_search_index_extended_promotional_stock'`,
          )
          .get(),
      ).toEqual({ name: "idx_search_index_extended_promotional_stock" })
    } finally {
      await db.destroy()
    }
  } finally {
    database.close()
  }
})

test("pre-deploy rollout refuses an empty D1 instead of creating placeholders", async () => {
  const tempDirectory = await mkdtemp(
    path.join(tmpdir(), "jlcsearch-empty-rollout-"),
  )
  const databasePath = path.join(tempDirectory, "d1.sqlite")
  const database = new Database(databasePath, { create: true })

  try {
    const migrationFiles = (
      await readdir(new URL("../cf-proxy/migrations", import.meta.url))
    )
      .filter((file) => file.endsWith(".sql"))
      .sort()
    for (const migrationFile of migrationFiles) {
      const migration = await Bun.file(
        new URL(`../cf-proxy/migrations/${migrationFile}`, import.meta.url),
      ).text()
      database.exec(migration)
    }
  } finally {
    database.close()
  }

  const fakeBinDirectory = await installFakeWrangler(
    tempDirectory,
    databasePath,
  )
  try {
    const result = await runShellScript(
      "cf-proxy/scripts/prepare-extended-promotional-search-rollout.sh",
      fakeBinDirectory,
      databasePath,
    )
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain(
      "Remote component_catalog does not exist; run a full_catalog sync before deploying the Worker.",
    )

    const proof = new Database(databasePath, { readonly: true })
    try {
      expect(
        proof
          .query(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table'
               AND name IN ('component_catalog', 'search_index')
             ORDER BY name`,
          )
          .all(),
      ).toEqual([])
    } finally {
      proof.close()
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
})

test("pre-deploy rollout upgrades existing search schemas before worker reads", async () => {
  const tempDirectory = await mkdtemp(
    path.join(tmpdir(), "jlcsearch-existing-rollout-"),
  )
  const databasePath = path.join(tempDirectory, "d1.sqlite")
  const database = new Database(databasePath, { create: true })
  database.exec(`
    CREATE TABLE component_catalog (
      lcsc INTEGER NOT NULL UNIQUE,
      category TEXT,
      subcategory TEXT,
      mfr TEXT,
      package TEXT,
      basic INTEGER,
      preferred INTEGER,
      description TEXT,
      stock INTEGER,
      price TEXT,
      extra TEXT
    );
    CREATE TABLE search_index (
      lcsc INTEGER NOT NULL UNIQUE,
      mfr TEXT,
      package TEXT,
      description TEXT,
      stock INTEGER,
      price TEXT,
      price1 REAL,
      basic INTEGER,
      preferred INTEGER,
      category TEXT,
      subcategory TEXT,
      manufacturer_name TEXT,
      title TEXT,
      mpn TEXT,
      attributes TEXT,
      search_text TEXT
    );

    INSERT INTO component_catalog (
      lcsc, category, subcategory, mfr, package, basic, preferred,
      description, stock, price, extra
    ) VALUES
      (1001, 'Connectors', 'HDMI', 'HDMI-BASE', 'SMD', 1, 1,
       'Base HDMI part', 100, '1-:1.25', '{}'),
      (1002, 'Connectors', 'HDMI', 'HDMI-EXT', 'SMD', 0, 1,
       'Extended promotional HDMI part', 200, '1-:1.50', '{}'),
      (1003, 'Connectors', 'HDMI', 'HDMI-REGULAR-EXT', 'SMD', 0, 0,
       'Regular extended HDMI part', 150, '1-:1.75', '{}');
    INSERT INTO search_index (
      lcsc, mfr, package, description, stock, price, price1, basic,
      preferred, category, subcategory, search_text
    )
    SELECT
      lcsc, mfr, package, description, stock, price, NULL, basic,
      preferred, category, subcategory, lower(description)
    FROM component_catalog;
  `)

  expect(() =>
    database
      .query(
        "SELECT is_extended_promotional FROM search_index WHERE lcsc = 1002",
      )
      .all(),
  ).toThrow(/no such column: is_extended_promotional/)

  database.close()

  const fakeBinDirectory = await installFakeWrangler(
    tempDirectory,
    databasePath,
  )
  const firstRun = await runShellScript(
    "cf-proxy/scripts/prepare-extended-promotional-search-rollout.sh",
    fakeBinDirectory,
    databasePath,
  )
  expect(firstRun).toMatchObject({ exitCode: 0 })
  const secondRun = await runShellScript(
    "cf-proxy/scripts/prepare-extended-promotional-search-rollout.sh",
    fakeBinDirectory,
    databasePath,
  )
  expect(secondRun).toMatchObject({ exitCode: 0 })

  const upgraded = new Database(databasePath)

  const db = new Kysely<any>({
    dialect: new BunSqliteDialect({ database: upgraded }),
  })
  const searchDb = db as unknown as Parameters<typeof searchIndex>[0]

  try {
    const rows = await searchIndex(searchDb, {
      is_extended_promotional: "true",
    })
    expect(rows.map((row) => row.lcsc)).toEqual([1002])
    expect(
      upgraded
        .query(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'index'
             AND name = 'idx_search_index_extended_promotional_stock'`,
        )
        .get(),
    ).toEqual({ name: "idx_search_index_extended_promotional_stock" })
    expect(
      upgraded
        .query(
          `SELECT lcsc, is_extended_promotional
           FROM component_catalog
           ORDER BY lcsc`,
        )
        .all(),
    ).toEqual([
      { lcsc: 1001, is_extended_promotional: 0 },
      { lcsc: 1002, is_extended_promotional: 1 },
      { lcsc: 1003, is_extended_promotional: 0 },
    ])
  } finally {
    await db.destroy()
    upgraded.close()
    await rm(tempDirectory, { recursive: true, force: true })
  }
})

test("batched search index rebuild preserves extended promotional classification", async () => {
  const tempDirectory = await mkdtemp(
    path.join(tmpdir(), "jlcsearch-rebuild-search-"),
  )
  const databasePath = path.join(tempDirectory, "d1.sqlite")
  const database = new Database(databasePath, { create: true })

  database.exec(`
    CREATE TABLE component_catalog (
      lcsc INTEGER NOT NULL UNIQUE,
      category TEXT,
      subcategory TEXT,
      mfr TEXT,
      package TEXT,
      basic INTEGER,
      preferred INTEGER,
      is_extended_promotional INTEGER,
      description TEXT,
      stock INTEGER,
      price TEXT,
      extra TEXT
    );
    CREATE TABLE search_index (
      lcsc INTEGER,
      mfr TEXT,
      package TEXT,
      description TEXT,
      stock INTEGER,
      price TEXT,
      price1 REAL,
      basic INTEGER,
      preferred INTEGER,
      is_extended_promotional INTEGER,
      category TEXT,
      subcategory TEXT,
      manufacturer_name TEXT,
      title TEXT,
      mpn TEXT,
      attributes TEXT,
      search_text TEXT
    );
    INSERT INTO component_catalog (
      lcsc, category, subcategory, mfr, package, basic, preferred,
      is_extended_promotional, description, stock, price, extra
    ) VALUES
      (2001, 'Connectors', 'HDMI', 'HDMI-BASE', 'SMD', 1, 1, 0,
       'Base HDMI part', 100, '1-:1.25', '{}'),
      (2002, 'Connectors', 'HDMI', 'HDMI-EXT', 'SMD', 0, 1, 1,
       'Extended promotional HDMI part', 200, '1-:1.50', '{}');
    INSERT INTO search_index(lcsc, is_extended_promotional)
    VALUES (9999, 0);
  `)
  database.close()

  const fakeBinDirectory = await installFakeWrangler(
    tempDirectory,
    databasePath,
  )
  const fakeRipgrepPath = path.join(fakeBinDirectory, "rg")
  await Bun.write(
    fakeRipgrepPath,
    "#!/usr/bin/env bash\necho 'rg must not be used by this test' >&2\nexit 127\n",
  )
  await chmod(fakeRipgrepPath, 0o755)

  const script = Bun.spawn({
    cmd: ["bash", "cf-proxy/scripts/rebuild-search-index-batched.sh"],
    cwd: path.resolve(import.meta.dir, ".."),
    env: {
      ...process.env,
      DB_NAME: "test",
      BATCH_SIZE: "1",
      FAKE_D1_PATH: databasePath,
      PATH: `${fakeBinDirectory}:${process.env.PATH ?? ""}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    script.exited,
    new Response(script.stdout).text(),
    new Response(script.stderr).text(),
  ])
  expect({ exitCode, stdout, stderr }).toMatchObject({ exitCode: 0 })

  const rebuilt = new Database(databasePath, { readonly: true })
  try {
    expect(
      rebuilt
        .query(
          `SELECT lcsc, is_extended_promotional
           FROM search_index
           ORDER BY lcsc`,
        )
        .all(),
    ).toEqual([
      { lcsc: 2001, is_extended_promotional: 0 },
      { lcsc: 2002, is_extended_promotional: 1 },
    ])
    expect(
      rebuilt
        .query(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'index'
             AND name = 'idx_search_index_extended_promotional_stock'`,
        )
        .get(),
    ).toEqual({ name: "idx_search_index_extended_promotional_stock" })
  } finally {
    rebuilt.close()
  }
  await rm(tempDirectory, { recursive: true, force: true })
})
