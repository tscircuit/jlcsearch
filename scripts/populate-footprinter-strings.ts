import { join } from "node:path"
import { circuitJsonToFootprinter } from "circuit-json-to-footprinter"
import { EasyEdaJsonSchema, convertEasyEdaJsonToCircuitJson } from "easyeda"
import { fetchEasyEDAComponent } from "easyeda/browser"
import {
  COPPER_IOU_THRESHOLD,
  type FootprinterStringRow,
  buildFootprinterStringUpsert,
  createFootprinterStringRow,
} from "../lib/footprinter-strings"

const DATABASE_NAME = "jlcsearch"
const DEFAULT_RUNTIME_MINUTES = 60
const QUERY_BATCH_SIZE = 25
const WRITE_BATCH_SIZE = 10
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

const runWrangler = async (args: readonly string[]): Promise<unknown> => {
  const child = Bun.spawn(["bunx", "wrangler", ...args], {
    cwd: CF_PROXY_DIRECTORY,
    env: process.env,
    stderr: "inherit",
    stdout: "pipe",
  })
  const output = await new Response(child.stdout).text()
  const exitCode = await child.exited
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
): Promise<ComponentCatalogRow[]> => {
  const payload = await runWrangler([
    "d1",
    "execute",
    DATABASE_NAME,
    "--remote",
    "--json",
    "--command",
    buildComponentQuery(cursor, retryNullEntries),
  ])

  return getWranglerRows(payload).map((row) => {
    const component = row as ComponentCatalogRow
    return {
      ...component,
      lcsc: Number(component.lcsc),
      stock: Number(component.stock),
    }
  })
}

const fetchWithTimeout: typeof fetch = Object.assign(
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
)

const deriveFootprinterRow = async (
  component: ComponentCatalogRow,
): Promise<FootprinterStringRow> => {
  const lcsc = `C${component.lcsc}`
  const rawEasyEdaJson = await fetchEasyEDAComponent(lcsc, {
    fetch: fetchWithTimeout,
    includeModelMetadata: false,
  })
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
}

const flushRows = async (rows: FootprinterStringRow[]): Promise<void> => {
  if (rows.length === 0) return

  await runWrangler([
    "d1",
    "execute",
    DATABASE_NAME,
    "--remote",
    "--json",
    "--command",
    buildFootprinterStringUpsert(rows),
  ])
  console.log(`Saved ${rows.length} footprinter_strings rows.`)
  rows.length = 0
}

const waitForRateLimit = async (deadline: number): Promise<boolean> => {
  if (Date.now() + RATE_LIMIT_COOLDOWN_MS + GRACE_PERIOD_MS >= deadline) {
    console.log(
      "EasyEDA rate limit reached too near the deadline; exiting cleanly.",
    )
    return false
  }

  console.log(
    "EasyEDA rate limit reached; waiting 120 seconds before continuing.",
  )
  const cooldownEndsAt = Date.now() + RATE_LIMIT_COOLDOWN_MS
  while (!stopRequested && Date.now() < cooldownEndsAt) {
    await Bun.sleep(Math.min(1_000, cooldownEndsAt - Date.now()))
  }
  return !stopRequested
}

const main = async () => {
  const options = parseOptions(Bun.argv.slice(2))
  const startedAt = Date.now()
  const deadline = startedAt + options.maxRuntimeMinutes * 60_000
  const pendingRows: FootprinterStringRow[] = []
  let cursor: Cursor | null = null
  let attempted = 0
  let failed = 0
  let matched = 0
  let recorded = 0

  console.log(
    `Populating footprinter_strings sequentially for up to ${options.maxRuntimeMinutes} minute(s); strings require copper_iou > ${COPPER_IOU_THRESHOLD}.`,
  )

  while (!stopRequested && Date.now() + GRACE_PERIOD_MS < deadline) {
    const components = await fetchComponents(cursor, options.retryNullEntries)
    if (components.length === 0) {
      console.log("No more eligible component_catalog rows were found.")
      break
    }

    for (const component of components) {
      cursor = { lcsc: component.lcsc, stock: component.stock }
      if (
        stopRequested ||
        Date.now() + GRACE_PERIOD_MS >= deadline ||
        (options.maxComponents !== null && attempted >= options.maxComponents)
      ) {
        break
      }

      attempted += 1
      try {
        const row = await deriveFootprinterRow(component)
        pendingRows.push(row)
        recorded += 1
        if (row.footprinterString !== null) matched += 1
        console.log(
          `C${component.lcsc}: ${row.footprinterString ?? "no >95% match"} (${row.copperIou?.toFixed(4) ?? "no candidate"})`,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes("rate limit exceeded")) {
          attempted -= 1
          if (!(await waitForRateLimit(deadline))) {
            stopRequested = true
            break
          }
          continue
        }
        failed += 1
        console.warn(
          `C${component.lcsc}: ${message}; leaving it eligible to retry.`,
        )
      }

      if (pendingRows.length >= WRITE_BATCH_SIZE) {
        await flushRows(pendingRows)
      }
    }

    if (options.maxComponents !== null && attempted >= options.maxComponents) {
      console.log(`Reached the ${options.maxComponents}-component limit.`)
      break
    }
  }

  await flushRows(pendingRows)
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(
    `Finished cleanly after ${elapsedSeconds}s: ${attempted} attempted, ${recorded} recorded, ${matched} matched, ${failed} failed.`,
  )
}

if (import.meta.main) {
  await main()
}
