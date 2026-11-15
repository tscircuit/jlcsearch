import { expect, test, vi } from "vitest"
import type { CompiledQuery } from "kysely"
import { createD1QueryLogger, errorKind } from "../src/d1-observability"
import {
  createFixture,
  RESISTORS_URL,
  seedCache,
} from "./d1-error-fallback-fixture"

const query = {
  sql: "SELECT * FROM search_index JOIN search_index_fts WHERE search_text LIKE 'private-search-text'",
  parameters: ["private-parameter"],
} as unknown as CompiledQuery

test("query diagnostics record slow operations and errors without query contents", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    const log = createD1QueryLogger("/api/search")
    log({ level: "query", query, queryDurationMillis: 249 })
    expect(warn).not.toHaveBeenCalled()
    log({ level: "query", query, queryDurationMillis: 250.123 })
    expect(warn).toHaveBeenCalledWith({
      event: "d1_slow_query",
      route: "/api/search",
      query_kind: "text_search",
      duration_ms: 250.1,
    })
    log({
      level: "error",
      query,
      queryDurationMillis: 10001,
      error: new Error(
        "D1 DB is overloaded: private-error-details [code: 7429]",
      ),
    })
    expect(error).toHaveBeenCalledWith({
      event: "d1_query_error",
      route: "/api/search",
      query_kind: "text_search",
      duration_ms: 10001,
      error_kind: "overloaded",
    })
    expect(JSON.stringify([warn.mock.calls, error.mock.calls])).not.toContain(
      "private-",
    )
  } finally {
    warn.mockRestore()
    error.mockRestore()
  }
})

test.each([
  [
    "D1 DB is overloaded. Too many resources consumed within a 10 second window.",
    "overloaded",
  ],
  ["D1 internal error [code: 7429]", "overloaded"],
  ["Query timed out", "timeout"],
  ["no such table: search_index_fts", "missing_schema"],
  ["unexpected failure with private details", "other"],
])("classifies %s", (message, kind) => {
  expect(errorKind(new Error(message))).toBe(kind)
})

test("cached success still records the database failure that caused fallback", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    const { env, self, state } = createFixture()
    await seedCache(env, 180)
    state.failReads = true
    const response = await self.fetch(
      `${RESISTORS_URL}?search=private-search-text`,
      {
        headers: {
          authorization: "private-token",
          origin: "https://private-client.example",
        },
      },
    )
    expect(response.status).toBe(200)
    expect(
      error.mock.calls.some(
        ([fields]: any[]) =>
          fields.event === "d1_query_error" &&
          fields.error_kind === "overloaded",
      ),
    ).toBe(true)
    expect(log).toHaveBeenCalledWith({
      event: "request_completed",
      route: "/resistors/list",
      status: 200,
      cache: "STALE-ERROR",
      duration_ms: expect.any(Number),
    })
    expect(JSON.stringify([log.mock.calls, error.mock.calls])).not.toContain(
      "private-",
    )
  } finally {
    log.mockRestore()
    error.mockRestore()
  }
})

test("fresh cache hits are visible without producing a database error log", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    const { env, self, queries } = createFixture()
    await seedCache(env, 1)
    expect((await self.fetch(RESISTORS_URL)).status).toBe(200)
    expect(queries).toEqual([])
    expect(error).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith({
      event: "request_completed",
      route: "/resistors/list",
      status: 200,
      cache: "HIT",
      duration_ms: expect.any(Number),
    })
  } finally {
    log.mockRestore()
    error.mockRestore()
  }
})

test("dynamic identifiers and unknown request paths do not enter request summaries", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  try {
    const { self } = createFixture()
    await self.fetch("https://example.com/api/footprinter_strings/C123456")
    await self.fetch("https://example.com/private-path/123456")
    expect(
      log.mock.calls
        .filter(([fields]: any[]) => fields.event === "request_completed")
        .map(([fields]: any[]) => fields.route),
    ).toEqual(["/api/footprinter_strings/:lcsc", "other"])
    expect(JSON.stringify(log.mock.calls)).not.toContain("123456")
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-path")
  } finally {
    log.mockRestore()
  }
})
