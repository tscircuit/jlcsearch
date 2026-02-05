/**
 * Generates a cache key from a URL by hashing the normalized path and sorted query params.
 */
export async function generateCacheKey(url: URL): Promise<string> {
  const normalized = normalizeUrl(url)
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Normalizes a URL for consistent cache key generation.
 * - Uses only pathname and search params (ignores origin, hash, etc.)
 * - Sorts query parameters alphabetically
 * - Removes trailing slashes from pathname (except root)
 */
export function normalizeUrl(url: URL): string {
  // Normalize pathname - remove trailing slash except for root
  let pathname = url.pathname
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1)
  }

  // Sort query parameters alphabetically
  const params = new URLSearchParams(url.searchParams)
  const sortedParams = new URLSearchParams()
  // Use Set to deduplicate keys since keys() returns duplicates for multi-value params
  const keys = Array.from(new Set(params.keys())).sort()
  for (const key of keys) {
    const values = params.getAll(key).sort()
    for (const value of values) {
      sortedParams.append(key, value)
    }
  }

  const search = sortedParams.toString()
  return search ? `${pathname}?${search}` : pathname
}
