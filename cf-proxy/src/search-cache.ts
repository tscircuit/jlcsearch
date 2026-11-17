import { tokenizeSearchTerm } from "./search-query"

// Call only after validation and exact-part routing, for JSON responses.
// HTML includes the original search in its title/form and cannot share a body.
export const normalizeSearchCacheUrl = (
  url: URL,
  parameter: "q" | "search",
): URL => {
  const cacheUrl = new URL(url)
  let query = (cacheUrl.searchParams.get(parameter) ?? "").trim().toLowerCase()
  // Tokenized searches ignore whitespace between terms. Unicode-only searches
  // fall back to a literal phrase, where internal whitespace must be preserved.
  if (tokenizeSearchTerm(query).length) query = query.replace(/\s+/g, " ")
  if (query) cacheUrl.searchParams.set(parameter, query)
  else cacheUrl.searchParams.delete(parameter)

  // /api/search defaults to 100 and accepts leading zeros in a valid limit.
  // /components/list always uses 100 and drops limit before reaching this code.
  if (parameter === "q") {
    const limit = Number(cacheUrl.searchParams.get("limit") ?? 100)
    if (limit === 100) cacheUrl.searchParams.delete("limit")
    else cacheUrl.searchParams.set("limit", String(limit))
  }
  return cacheUrl
}
