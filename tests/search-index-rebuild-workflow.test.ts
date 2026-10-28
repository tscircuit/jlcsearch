import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { chmod, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

test("failed FTS batch leaves index disabled; retry completes before marking ready", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jlcsearch-fts-"))
  const databasePath = join(directory, "catalog.sqlite")
  const commandLog = join(directory, "commands.jsonl")
  const db = new Database(databasePath)
  try {
    db.exec(`
      CREATE TABLE search_index (lcsc INTEGER, search_text TEXT);
      INSERT INTO search_index VALUES
        (431535, 'pj-320d'), (21659, 'xc6206p182mr'), (3, 'third part');
    `)
    const scripts = new URL("../cf-proxy/scripts/", import.meta.url)
    db.exec(await Bun.file(new URL("setup-fts5.sql", scripts)).text())
    // Begin with a ready previous generation: initialization must disable it.
    db.exec("UPDATE search_index_fts_meta SET value = '1' WHERE key = 'ready'")
    const fixture = new URL(
      "./fixtures/fts-rebuild-wrangler.ts",
      import.meta.url,
    )
    const bunx = join(directory, "bunx")
    await Bun.write(
      bunx,
      `#!${process.execPath}\nimport ${JSON.stringify(fixture.href)}\n`,
    )
    await chmod(bunx, 0o755)

    for (const failBatch of ["2", "0"]) {
      await Bun.write(commandLog, "")
      const child = Bun.spawn(
        [
          "bash",
          fileURLToPath(
            new URL("rebuild-search-index-fts-batched.sh", scripts),
          ),
        ],
        {
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            MAX_ROWID: "3",
            FTS_BATCH_ROWS: "1",
            TEST_FTS_DATABASE: databasePath,
            TEST_FTS_COMMAND_LOG: commandLog,
            TEST_FTS_FAIL_BATCH: failBatch,
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      const failed = failBatch === "2"
      expect(exitCode).toBe(failed ? 23 : 0)
      expect(stderr).toBe(failed ? "Simulated D1 batch failure\n" : "")
      expect(stdout.includes("rebuild complete")).toBe(!failed)
      expect(
        db
          .query("SELECT value FROM search_index_fts_meta WHERE key = 'ready'")
          .get(),
      ).toEqual({ value: failed ? "0" : "1" })
      expect(
        db.query("SELECT COUNT(*) AS count FROM search_index_fts").get(),
      ).toEqual({
        count: failed ? 1 : 3,
      })
      const commands: string[] = (await Bun.file(commandLog).text())
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
      expect(commands.some((sql) => sql.includes("BETWEEN 3 AND 3"))).toBe(
        !failed,
      )
      expect(commands.some((sql) => sql.includes("SET value = '1'"))).toBe(
        !failed,
      )
    }
  } finally {
    db.close()
    await rm(directory, { recursive: true, force: true })
  }
})
