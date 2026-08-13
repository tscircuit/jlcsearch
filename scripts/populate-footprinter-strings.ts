import { join } from "node:path"
import { circuitJsonToFootprinter } from "circuit-json-to-footprinter"
import { EasyEdaJsonSchema, convertEasyEdaJsonToCircuitJson } from "easyeda"
import { fetchEasyEDAComponent } from "easyeda/browser"
import {
  COPPER_IOU_THRESHOLD,
  type FootprinterStringRow,
  buildFootprinterStringUpsert,
  createFootprinterStringRow,
  isPermanentEasyEdaMiss,
} from "../lib/footprinter-strings"
import {
  PoliteRateLimitedFetch,
  RequestDeadlineReachedError,
  type PoliteRateLimitedFetchMetrics,
} from "../lib/polite-rate-limited-fetch"

const DATABASE_NAME = "jlcsearch"
const DEFAULT_RUNTIME_MINUTES = 240
const QUERY_BATCH_SIZE = 250
const WRITE_BATCH_SIZE = 50
const COMPONENT_CONCURRENCY = 8
const EASYEDA_REQUESTS_PER_SECOND = 4
const EASYEDA_REQUESTS_PER_SECOND_AFTER_403 = 1
const FETCH_TIMEOUT_MS = 20_000
const RATE_LIMIT_COOLDOWN_MS = 120_000
const GRACE_PERIOD_MS = 45_000
const CF_PROXY_DIRECTORY = join(import.meta.dir, "../cf-proxy")

interface ComponentCatalogRow {
  description: string | null
  lcsc: number
  mfr: string | null
  package: string | null
  stock: number
}

interface Cursor {
  lcsc: number
  stock: number
}

interface Options {
  maxComponents: number | null
  maxRuntimeMinutes: number
  retryNullEntries: boolean
}

interface WranglerResult {
  results?: unknown
  success?: boolean
}

interface TimingMetrics extends PoliteRateLimitedFetchMetrics {
  conversionCount: number
  conversionDurationMs: number
  d1ReadCount: number
  d1ReadDurationMs: number
  d1WriteCount: number
  d1WriteDurationMs: number
}

type WranglerOperation = "read" | "write"

type ComponentResult =
  | { row: FootprinterStringRow; status: "matched" | "no-match" }
  | { row: FootprinterStringRow; status: "permanent-miss" }
  | { status: "rate-limited" }
  | { status: "retryable-failure" }
  | { status: "stopped" }

let stopRequested = false
const stopController = new AbortController()

const requestGracefulStop = (signal: string) => {
  console.log(`Received ${signal}; stopping and flushing completed components.`)
  stopRequested = true
  stopController.abort(signal)
}

process.on("SIGINT", () => requestGracefulStop("SIGINT"))
process.on("SIGTERM", () => requestGracefulStop("SIGTERM"))

const parsePositiveInteger = (value: string, name: string): number => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

const parseOptions = (args: readonly string[]): Options => {
  const options: Options = {
    maxComponents: null,
    maxRuntimeMinutes: DEFAULT_RUNTIME_MINUTES,
    retryNullEntries: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--retry-null-entries") {
      options.retryNullEntries = true
      continue
    }

    const value = args[index + 1]
    if (!value) throw new Error(`Missing value for ${argument}`)

    if (argument === "--max-components") {
      options.maxComponents = parsePositiveInteger(value, argument)
    } else if (argument === "--max-runtime-minutes") {
      options.maxRuntimeMinutes = parsePositiveInteger(value, argument)
      if (options.maxRuntimeMinutes > DEFAULT_RUNTIME_MINUTES) {
        throw new Error(
          `--max-runtime-minutes cannot exceed ${DEFAULT_RUNTIME_MINUTES}`,
        )
      }
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
    index += 1
  }

  return options
}

const runWrangler = async (
  args: readonly string[],
  operation: WranglerOperation,
  metrics: TimingMetrics,
): Promise<unknown> => {
  const startedAt = Date.now()
  const child = Bun.spawn(["bunx", "wrangler", ...args], {
    cwd: CF_PROXY_DIRECTORY,
    env: process.env,
    stderr: "inherit",
    stdout: "pipe",
  })
  const output = await new Response(child.stdout).text()
  const exitCode = await child.exited
  const durationMs = Date.now() - startedAt
  if (operation === "read") {
    metrics.d1ReadCount += 1
    metrics.d1ReadDurationMs += durationMs
  } else {
    metrics.d1WriteCount += 1
    metrics.d1WriteDurationMs += durationMs
  }
  if (exitCode !== 0) {
    throw new Error(`Wrangler exited with code ${exitCode}`)
  }

  try {
    return JSON.parse(output)
  } catch {
    throw new Error(`Wrangler returned invalid JSON: ${output.slice(0, 500)}`)
  }
}

const getWranglerRows = (payload: unknown): unknown[] => {
  const entries = Array.isArray(payload) ? payload : [payload]
  for (const entry of entries) {
    const result = entry as WranglerResult
    if (result.success === false) throw new Error("Wrangler D1 query failed")
    if (Array.isArray(result.results)) return result.results
  }
  return []
}

const buildComponentQuery = (
  cursor: Cursor | null,
  retryNullEntries: boolean,
): string => {
  const unprocessedCondition = retryNullEntries
    ? "(f.lcsc IS NULL OR f.footprinter_string IS NULL)"
    : "f.lcsc IS NULL"
  const cursorCondition = cursor
    ? `AND (
      c.stock < ${cursor.stock}
      OR (c.stock = ${cursor.stock} AND c.lcsc > ${cursor.lcsc})
    )`
    : ""

  return `SELECT
  c.lcsc,
  c.mfr,
  c.package,
  c.description,
  c.stock
FROM component_catalog AS c
LEFT JOIN footprinter_strings AS f ON f.lcsc = c.lcsc
WHERE c.lcsc IS NOT NULL
  AND ${unprocessedCondition}
  ${cursorCondition}
ORDER BY c.stock DESC, c.lcsc ASC
LIMIT ${QUERY_BATCH_SIZE};`
}

const fetchComponents = async (
  cursor: Cursor | null,
  retryNullEntries: boolean,
  metrics: TimingMetrics,
): Promise<ComponentCatalogRow[]> => {
  const payload = await runWrangler(
    [
      "d1",
      "execute",
      DATABASE_NAME,
      "--remote",
      "--json",
      "--command",
      buildComponentQuery(cursor, retryNullEntries),
    ],
    "read",
    metrics,
  )

  return getWranglerRows(payload).map((row) => {
    const component = row as ComponentCatalogRow
    return {
      ...component,
      lcsc: Number(component.lcsc),
      stock: Number(component.stock),
    }
  })
}

const deriveFootprinterRow = async (
  component: ComponentCatalogRow,
  easyEdaFetch: typeof fetch,
  metrics: TimingMetrics,
): Promise<FootprinterStringRow> => {
  const lcsc = `C${component.lcsc}`
  const rawEasyEdaJson = await fetchEasyEDAComponent(lcsc, {
    fetch: easyEdaFetch,
    includeModelMetadata: false,
  })
  const conversionStartedAt = Date.now()
  metrics.conversionCount += 1
  try {
    const circuitJson = convertEasyEdaJsonToCircuitJson(
      EasyEdaJsonSchema.parse(rawEasyEdaJson),
      { useModelCdn: false },
    )
    const sourceHint = [
      lcsc,
      component.mfr,
      component.package,
      component.description,
    ]
      .filter(Boolean)
      .join(" ")
    const discovery = circuitJsonToFootprinter(circuitJson, {
      maxCandidates: 3,
      sourceHints: [sourceHint],
    })

    return createFootprinterStringRow(component.lcsc, discovery.best)
  } finally {
    metrics.conversionDurationMs += Date.now() - conversionStartedAt
  }
}

const flushRows = async (
  rows: FootprinterStringRow[],
  metrics: TimingMetrics,
): Promise<void> => {
  if (rows.length === 0) return

  await runWrangler(
    [
      "d1",
      "execute",
      DATABASE_NAME,
      "--remote",
      "--json",
      "--command",
      buildFootprinterStringUpsert(rows),
    ],
    "write",
    metrics,
  )
  console.log(`Saved ${rows.length} footprinter_strings rows.`)
  rows.length = 0
}

const processComponent = async (
  component: ComponentCatalogRow,
  easyEdaFetch: typeof fetch,
  metrics: TimingMetrics,
): Promise<ComponentResult> => {
  try {
    const row = await deriveFootprinterRow(component, easyEdaFetch, metrics)
    console.log(
      `C${component.lcsc}: ${row.footprinterString ?? "no >95% match"} (${row.copperIou?.toFixed(4) ?? "no candidate"})`,
    )
    return {
      row,
      status: row.footprinterString === null ? "no-match" : "matched",
    }
  } catch (error) {
    if (error instanceof RequestDeadlineReachedError || stopRequested) {
      return { status: "stopped" }
    }

    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("rate limit exceeded")) {
      console.warn(
        `C${component.lcsc}: ${message}; leaving it eligible to retry after the global cooldown.`,
      )
      return { status: "rate-limited" }
    }

    if (isPermanentEasyEdaMiss(error)) {
      console.warn(
        `C${component.lcsc}: ${message}; recording a permanent null result.`,
      )
      return {
        row: createFootprinterStringRow(component.lcsc, null),
        status: "permanent-miss",
      }
    }

    console.warn(
      `C${component.lcsc}: ${message}; leaving it eligible to retry.`,
    )
    return { status: "retryable-failure" }
  }
}

const createTimingMetrics = (): TimingMetrics => ({
  conversionCount: 0,
  conversionDurationMs: 0,
  cooldownCount: 0,
  d1ReadCount: 0,
  d1ReadDurationMs: 0,
  d1WriteCount: 0,
  d1WriteDurationMs: 0,
  requestCount: 0,
  requestDurationMs: 0,
  throttleWaitMs: 0,
})

const formatAverage = (durationMs: number, count: number): string =>
  count === 0 ? "0.0" : (durationMs / count).toFixed(1)

const main = async () => {
  const options = parseOptions(Bun.argv.slice(2))
  const startedAt = Date.now()
  const deadline = startedAt + options.maxRuntimeMinutes * 60_000
  const requestDeadline = deadline - GRACE_PERIOD_MS
  const cpuStartedAt = process.cpuUsage()
  const metrics = createTimingMetrics()
  let cursor: Cursor | null = null
  let attempted = 0
  let failed = 0
  let matched = 0
  let permanentMisses = 0
  let recorded = 0

  const limiter = new PoliteRateLimitedFetch({
    cooldownMs: RATE_LIMIT_COOLDOWN_MS,
    cooldownRequestsPerSecond: EASYEDA_REQUESTS_PER_SECOND_AFTER_403,
    deadline: requestDeadline,
    fetch: Object.assign(
      (input: Parameters<typeof fetch>[0], init: RequestInit = {}) => {
        const signals = [
          stopController.signal,
          AbortSignal.timeout(FETCH_TIMEOUT_MS),
        ]
        if (init.signal) signals.push(init.signal)
        return fetch(input, {
          ...init,
          signal: AbortSignal.any(signals),
        })
      },
      { preconnect: fetch.preconnect },
    ),
    metrics,
    onCooldown: (cooldownMs, requestsPerSecond) => {
      console.warn(
        `EasyEDA returned HTTP 403; pausing all requests for ${cooldownMs / 1_000}s, then limiting to ${requestsPerSecond} request/s.`,
      )
    },
    requestsPerSecond: EASYEDA_REQUESTS_PER_SECOND,
    signal: stopController.signal,
  })
  const easyEdaFetch: typeof fetch = Object.assign(
    (input: Parameters<typeof fetch>[0], init: RequestInit = {}) =>
      limiter.fetch(input, init),
    { preconnect: fetch.preconnect },
  )

  console.log(
    `Populating footprinter_strings with ${COMPONENT_CONCURRENCY} concurrent component(s) and a shared ${EASYEDA_REQUESTS_PER_SECOND} request/s EasyEDA limit for up to ${options.maxRuntimeMinutes} minute(s); strings require copper_iou > ${COPPER_IOU_THRESHOLD}.`,
  )

  while (!stopRequested && Date.now() + GRACE_PERIOD_MS < deadline) {
    const components = await fetchComponents(
      cursor,
      options.retryNullEntries,
      metrics,
    )
    if (components.length === 0) {
      console.log("No more eligible component_catalog rows were found.")
      break
    }

    for (
      let offset = 0;
      offset < components.length;
      offset += WRITE_BATCH_SIZE
    ) {
      const componentGroup = components.slice(offset, offset + WRITE_BATCH_SIZE)
      const completedRows: FootprinterStringRow[] = []
      let nextComponentIndex = 0

      const worker = async () => {
        while (nextComponentIndex < componentGroup.length) {
          if (
            stopRequested ||
            Date.now() >= requestDeadline ||
            (options.maxComponents !== null &&
              attempted >= options.maxComponents)
          ) {
            return
          }

          const component = componentGroup[nextComponentIndex]
          nextComponentIndex += 1
          cursor = { lcsc: component.lcsc, stock: component.stock }
          attempted += 1

          const result = await processComponent(
            component,
            easyEdaFetch,
            metrics,
          )
          if (result.status === "stopped" || result.status === "rate-limited") {
            attempted -= 1
          } else if (result.status === "retryable-failure") {
            failed += 1
          } else {
            completedRows.push(result.row)
            recorded += 1
            if (result.status === "matched") matched += 1
            if (result.status === "permanent-miss") permanentMisses += 1
          }
        }
      }

      await Promise.all(
        Array.from({ length: COMPONENT_CONCURRENCY }, () => worker()),
      )
      await flushRows(completedRows, metrics)

      if (
        stopRequested ||
        Date.now() >= requestDeadline ||
        (options.maxComponents !== null && attempted >= options.maxComponents)
      ) {
        break
      }
    }

    if (options.maxComponents !== null && attempted >= options.maxComponents) {
      console.log(`Reached the ${options.maxComponents}-component limit.`)
      break
    }
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  const elapsedMs = Date.now() - startedAt
  const cpuUsage = process.cpuUsage(cpuStartedAt)
  const cpuDurationMs = (cpuUsage.user + cpuUsage.system) / 1_000
  const cpuUtilization = (cpuDurationMs / elapsedMs) * 100
  console.log(
    `Finished cleanly after ${elapsedSeconds}s: ${attempted} attempted, ${recorded} recorded, ${matched} matched, ${permanentMisses} permanent misses, ${failed} retryable failures.`,
  )
  console.log(
    `Timing: EasyEDA ${metrics.requestCount} requests / ${metrics.requestDurationMs}ms (${formatAverage(metrics.requestDurationMs, metrics.requestCount)}ms avg), ${metrics.throttleWaitMs}ms aggregate throttle wait, ${metrics.cooldownCount} cooldown(s); conversion ${metrics.conversionCount} / ${metrics.conversionDurationMs}ms (${formatAverage(metrics.conversionDurationMs, metrics.conversionCount)}ms avg); D1 reads ${metrics.d1ReadCount} / ${metrics.d1ReadDurationMs}ms, writes ${metrics.d1WriteCount} / ${metrics.d1WriteDurationMs}ms; CPU ${cpuDurationMs.toFixed(0)}ms (${cpuUtilization.toFixed(1)}% of one core).`,
  )
}

if (import.meta.main) {
  await main()
}
