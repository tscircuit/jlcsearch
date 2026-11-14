import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

type Job = {
  if: string
  "timeout-minutes"?: number
  env?: Record<string, string>
  defaults?: { run: { "working-directory": string } }
  steps: {
    name?: string
    run?: string
    uses?: string
    env?: Record<string, string>
  }[]
}
const workflow = Bun.YAML.parse(
  await Bun.file(
    new URL("../.github/workflows/d1-migrations.yml", import.meta.url),
  ).text(),
) as {
  on: {
    workflow_dispatch: {
      inputs: { sync_scope: { default: string; options: string[] } }
    }
  }
  concurrency: { group: string; "cancel-in-progress": boolean; queue: string }
  jobs: Record<string, Job>
}

// These job guards use string comparisons and boolean operators shared by
// GitHub expressions and JavaScript. Evaluate the actual YAML guards so a
// changed condition cannot accidentally route index repair into a full sync.
const selectedJobs = (event: string, scope: string) =>
  Object.entries(workflow.jobs)
    .filter(([, job]) =>
      new Function("github", "inputs", `return (${job.if})`)(
        { event_name: event },
        { sync_scope: scope },
      ),
    )
    .map(([name]) => name)

test.each([
  ["workflow_dispatch", "search_index_only", ["search_index"]],
  ["workflow_dispatch", "stock_only", ["sync"]],
  ["workflow_dispatch", "full_catalog", ["sync"]],
  ["workflow_dispatch", "derived", ["sync"]],
  ["workflow_dispatch", "migrations_only", ["migrations"]],
  ["workflow_dispatch", "audit_microcontrollers", ["migrations"]],
  ["schedule", "", ["sync"]],
  ["push", "", ["sync"]],
])("routes %s / %s to the intended job", (event, scope, jobs) => {
  expect(selectedJobs(event, scope)).toEqual(jobs)
})

test("index repair is an explicit choice and shares the production sync lock", () => {
  const scope = workflow.on.workflow_dispatch.inputs.sync_scope
  expect(scope.options).toContain("search_index_only")
  expect(scope.default).toBe("stock_only")
  expect(workflow.concurrency).toEqual({
    group: "production-d1-sync",
    "cancel-in-progress": false,
    queue: "max",
  })
  expect(selectedJobs("push", "search_index_only")).not.toContain(
    "search_index",
  )
  expect(selectedJobs("schedule", "search_index_only")).not.toContain(
    "search_index",
  )
})

test("index repair uses only the standalone rebuild, with explicit target and bounded batches", () => {
  const job = workflow.jobs.search_index
  expect(job.defaults?.run["working-directory"]).toBe("cf-proxy")
  expect(job.env?.DB_NAME).toBe("jlcsearch")
  expect(job.env?.FTS_BATCH_ROWS).toBe("1000")
  expect(job.env?.FTS_PAUSE_SECONDS).toBe("1")
  expect(job["timeout-minutes"]).toBe(360)
  expect(Number(job.env?.RETRY_MAX_ATTEMPTS)).toBeGreaterThan(1)
  const commands = job.steps.flatMap((step) => (step.run ? [step.run] : []))
  expect(
    commands.filter((command) => /wrangler|scripts\/.*\.sh/.test(command)),
  ).toEqual(["bash scripts/rebuild-search-index-fts-batched.sh --remote"])
  expect(commands.join("\n")).not.toMatch(
    /sync-db|sync-stock|migrations apply|kv bulk delete|setup:derived/,
  )
})

test("catalog sync uses the same paced rebuild settings", () => {
  const upload = workflow.jobs.sync.steps.find(
    (step) => step.name === "Upload selected data to D1",
  )
  expect(upload?.env?.FTS_BATCH_ROWS).toBe("1000")
  expect(upload?.env?.FTS_PAUSE_SECONDS).toBe("1")
})

test("catalog sync forwards its database and pacing to the shared rebuild", async () => {
  const source = await Bun.file(
    new URL("../cf-proxy/scripts/sync-db.sh", import.meta.url),
  ).text()
  const rebuildFunction = source.match(
    /rebuild_remote_search_fts_index\(\) \{[\s\S]*?\n\}/,
  )?.[0]
  expect(rebuildFunction).toBeDefined()
  const directory = mkdtempSync(join(tmpdir(), "jlcsearch-fts-delegation-"))
  try {
    // Execute only the wrapper with a local stub, never the production sync.
    writeFileSync(
      join(directory, "rebuild-search-index-fts-batched.sh"),
      '#!/bin/bash\nprintf "%s\\n" "$DB_NAME" "$FTS_BATCH_ROWS" "$FTS_PAUSE_SECONDS" "$@"\n',
    )
    const result = Bun.spawnSync(
      [
        "bash",
        "-c",
        `SCRIPT_DIR="$1"\nDB_NAME=fixture-db\nFTS_BATCH_ROWS=123\nFTS_PAUSE_SECONDS=2\n${rebuildFunction}\nrebuild_remote_search_fts_index`,
        "bash",
        directory,
      ],
      { stdout: "pipe", stderr: "pipe" },
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout.toString().trim().split("\n")).toEqual([
      "fixture-db",
      "123",
      "2",
      "--remote",
    ])
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
