import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

test("FTS repair preserves catalog rows and recovers an acknowledged-late batch", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "jlcsearch-fts-repair-"))
  try {
    const dbPath = path.join(directory, "remote.sqlite3")
    const source = new Database(dbPath, { create: true })
    source.exec(`
      CREATE TABLE search_index(lcsc INTEGER, search_text TEXT);
      INSERT INTO search_index VALUES
        (32843, 'w5500 ethernet'), (47351, 'enc28j60 ethernet'),
        (411626, ''), (7498452, 'ch390h ethernet');
    `)
    source.close()
    const helper = path.join(directory, "wrangler.ts")
    await writeFile(
      helper,
      `
      import { Database } from "bun:sqlite";
      const args = process.argv.slice(2);
      if (args.some(a => a.startsWith("--file"))) throw Error("Unexpected import API");
      const sql = args[args.indexOf("--command") + 1];
      const db = new Database(process.env.TEST_DB!);
      if (args.includes("--json")) {
        console.log(JSON.stringify([{results: db.query(sql).all()}]));
      } else {
        db.exec(sql);
        const marker = process.env.TEST_DB + ".committed";
        if (sql.includes("DELETE FROM search_index_fts WHERE") && !await Bun.file(marker).exists()) {
          await Bun.write(marker, "yes");
          db.close();
          process.exit(1); // The server committed but the response was lost.
        }
      }
      db.close();
    `,
    )
    await writeFile(
      path.join(directory, "bunx"),
      `#!/bin/sh\nexec bun '${helper}' "$@"\n`,
      { mode: 0o755 },
    )
    const process = Bun.spawn(
      ["bash", "cf-proxy/scripts/rebuild-search-index-fts-batched.sh"],
      {
        env: {
          ...Bun.env,
          PATH: `${directory}:${Bun.env.PATH}`,
          TEST_DB: dbPath,
          FTS_BATCH_ROWS: "2",
          RETRY_BASE_DELAY_SECONDS: "0",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [stdout, stderr, exit] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ])
    expect({ exit, stderr }).toEqual({
      exit: 0,
      stderr: expect.stringContaining("retrying"),
    })
    expect(stdout).toContain("Verified 3 full-text search records")
    const result = new Database(dbPath)
    expect(
      result.query("SELECT COUNT(*) AS n FROM search_index").get(),
    ).toEqual({ n: 4 })
    expect(
      result
        .query(
          "SELECT rowid FROM search_index_fts WHERE search_index_fts MATCH 'enc28j60'",
        )
        .all(),
    ).toEqual([{ rowid: 2 }])
    expect(
      result
        .query("SELECT value FROM search_index_fts_meta WHERE key='ready'")
        .get(),
    ).toEqual({ value: "1" })
    result.close()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
