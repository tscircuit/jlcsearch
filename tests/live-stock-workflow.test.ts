import { expect, test } from "bun:test"
import { DEFAULT_STOCK_CLEANUP_MAX_PAGES } from "../scripts/expire-unverified-stock"

const workflow = Bun.YAML.parse(
  await Bun.file(
    new URL("../.github/workflows/live-stock.yml", import.meta.url),
  ).text(),
) as {
  on: {
    workflow_dispatch: {
      inputs: Record<string, { type: string; default: number | boolean }>
    }
  }
  jobs: Record<
    "refresh" | "requested",
    { if: string; env: Record<string, string> }
  >
}

// Evaluate the workflow's actual expression, including its numeric-to-string
// conversion. A plain `inputs.cleanup_max_pages || '5'` would lose a supplied 0.
const evaluate = (
  expression: string,
  event: string,
  inputs: Record<string, number | boolean>,
) =>
  new Function(
    "github",
    "inputs",
    "format",
    `return (${expression.replace(/^\$\{\{\s*|\s*\}\}$/g, "")})`,
  )({ event_name: event }, inputs, (_pattern: string, value: unknown) =>
    String(value ?? ""),
  )

test.each([
  ["workflow_dispatch", { cleanup_max_pages: 0, max_pages: 1 }, "0"],
  ["workflow_dispatch", { cleanup_max_pages: 2, max_pages: 1000 }, "2"],
  ["schedule", {}, "5"],
])(
  "%s preserves the independent cleanup budget %j",
  (event, inputs, expected) => {
    expect(
      evaluate(
        workflow.jobs.refresh.env.LIVE_STOCK_CLEANUP_MAX_PAGES,
        event,
        inputs,
      ),
    ).toBe(expected)
  },
)

test("manual and scheduled runs start with a small cleanup budget and PR checks cannot refresh production", () => {
  expect(workflow.on.workflow_dispatch.inputs.cleanup_max_pages).toMatchObject({
    type: "number",
    default: DEFAULT_STOCK_CLEANUP_MAX_PAGES,
  })
  expect(DEFAULT_STOCK_CLEANUP_MAX_PAGES).toBe(5)
  expect(evaluate(workflow.jobs.refresh.if, "pull_request", {})).toBe(false)
  expect(evaluate(workflow.jobs.refresh.if, "workflow_dispatch", {})).toBe(true)
  expect(evaluate(workflow.jobs.refresh.if, "schedule", {})).toBe(true)
})

test("popular-only dispatch skips the category crawl and only runs the requested-part refresh", () => {
  const inputs = { popular_only: true }
  expect(workflow.on.workflow_dispatch.inputs.popular_only).toMatchObject({
    type: "boolean",
    default: false,
  })
  expect(evaluate(workflow.jobs.refresh.if, "workflow_dispatch", inputs)).toBe(
    false,
  )
  expect(
    evaluate(workflow.jobs.requested.if, "workflow_dispatch", inputs),
  ).toBe(true)
  expect(evaluate(workflow.jobs.requested.if, "pull_request", {})).toBe(false)
  const mode = workflow.jobs.requested.env.REQUESTED_STOCK_POPULAR_ONLY
  expect(evaluate(mode, "workflow_dispatch", inputs)).toBe("true")
  expect(evaluate(mode, "schedule", {})).toBe("false")
})
