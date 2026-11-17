import type { LogEvent } from "kysely"

export const errorKind = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  if (
    /D1 (?:DB|database) is overloaded|Too many resources consumed within a 10 second window|\[code:\s*7429\]/i.test(
      message,
    )
  )
    return "overloaded"
  if (/timed? out|timeout/i.test(message)) return "timeout"
  if (/no such table|no such column/i.test(message)) return "missing_schema"
  return "other"
}

const queryKind = (sql: string): string => {
  if (/\bsearch_index_fts_meta\b/i.test(sql)) return "search_readiness"
  if (/\bsearch_index_fts\b/i.test(sql)) return "text_search"
  if (/\bselect\s+distinct\b/i.test(sql)) return "filter_options"
  if (/\bsearch_index\b/i.test(sql)) return "catalog_search"
  return "table_query"
}

export const logD1OperationError = (route: string, error: unknown): void => {
  console.error({
    event: "d1_operation_error",
    route,
    error_kind: errorKind(error),
  })
}

export const createD1QueryLogger =
  (route: string) =>
  (event: LogEvent): void => {
    if (event.level === "query" && event.queryDurationMillis < 250) return
    const fields = {
      route,
      query_kind: queryKind(event.query.sql),
      // Includes the binding round trip, not just SQLite execution time.
      duration_ms: Math.round(event.queryDurationMillis * 10) / 10,
    }
    if (event.level === "error") {
      console.error({
        event: "d1_query_error",
        ...fields,
        error_kind: errorKind(event.error),
      })
    } else {
      console.warn({ event: "d1_slow_query", ...fields })
    }
    // Never log SQL, bound parameters or raw exception messages.
  }
