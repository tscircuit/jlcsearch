import { expect, test } from "bun:test"

type Job = {
  if: string
  env?: Record<string, string>
  defaults?: { run: { "working-directory": string } }
  steps: { name?: string; run?: string; uses?: string }[]
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
  concurrency: { group: string; "cancel-in-progress": boolean }
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
  expect(Number(job.env?.FTS_BATCH_ROWS)).toBeGreaterThan(0)
  expect(Number(job.env?.FTS_BATCH_ROWS)).toBeLessThanOrEqual(5000)
  expect(Number(job.env?.RETRY_MAX_ATTEMPTS)).toBeGreaterThan(1)
  const commands = job.steps.flatMap((step) => (step.run ? [step.run] : []))
  expect(
    commands.filter((command) => /wrangler|scripts\/.*\.sh/.test(command)),
  ).toEqual(["bash scripts/rebuild-search-index-fts-batched.sh --remote"])
  expect(commands.join("\n")).not.toMatch(
    /sync-db|sync-stock|migrations apply|kv bulk delete|setup:derived/,
  )
})
