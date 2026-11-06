import { readFile } from "node:fs/promises"
import { gunzipSync } from "node:zlib"
import { encodeCatalog, type StandaloneComponent } from "./catalog"

/** A small, offline implementation of JLC search's HTTP contract. */
export async function createStandaloneJlcsearchHandler(
  catalogPath = new URL("./search-catalog.json.gz", import.meta.url),
) {
  const catalog = JSON.parse(
    gunzipSync(await readFile(catalogPath), {
      maxOutputLength: 32 * 1024 * 1024,
    }).toString("utf8"),
  )
  if (
    catalog.schema_version !== 1 ||
    catalog.source !== "jlcpcb" ||
    catalog.coverage !== "subset" ||
    !Array.isArray(catalog.components) ||
    typeof catalog.generated_at !== "string" ||
    !Number.isFinite(Date.parse(catalog.generated_at))
  )
    throw new Error("Invalid standalone JLC search catalog")
  // Reuse the exporter validation and field selection at the storage boundary.
  const components = JSON.parse(
    gunzipSync(
      encodeCatalog(catalog.components, catalog.generated_at),
    ).toString(),
  ).components as StandaloneComponent[]
  const metadata = {
    source: "jlcpcb",
    coverage: "subset",
    generated_at: catalog.generated_at,
  }
  return async (request: Request) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "X-Tscircuit-Catalog",
      "X-Tscircuit-Catalog": JSON.stringify(metadata),
    }
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "Access-Control-Allow-Methods": "GET, HEAD, POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    const url = new URL(request.url)
    if (url.pathname !== "/api/search")
      return new Response("Not found", { status: 404, headers })
    if (
      request.method === "POST" &&
      request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    ) {
      const body = await request.text()
      if (body.length > 64 * 1024)
        return new Response("Request too large", { status: 413, headers })
      for (const [key, value] of new URLSearchParams(body))
        url.searchParams.append(key, value)
    } else if (!["GET", "HEAD"].includes(request.method))
      return new Response("Method not allowed", { status: 405, headers })
    const allowed = new Set([
      "q",
      "limit",
      "package",
      "subcategory_name",
      "is_basic",
      "is_preferred",
    ])
    const limit = Number(url.searchParams.get("limit") ?? 100)
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      [...url.searchParams.keys()].some((key) => !allowed.has(key))
    )
      return Response.json(
        { error: "Unsupported search parameters" },
        { status: 400, headers },
      )
    const query = (url.searchParams.get("q") ?? "").trim().toLowerCase()
    const lcsc = /^c?\d+$/.test(query)
      ? Number(query.replace(/^c/, ""))
      : undefined
    const tokens = query.match(/[a-z0-9]+/g) ?? []
    const matches = components
      .filter((row) => {
        if (
          lcsc !== undefined
            ? row.lcsc !== lcsc
            : !tokens.every((token) =>
                `${row.mfr} ${row.package} ${row.description} ${row.category ?? ""} ${row.subcategory ?? ""}`
                  .toLowerCase()
                  .includes(token),
              )
        )
          return false
        if (
          url.searchParams.has("package") &&
          row.package !== url.searchParams.get("package")
        )
          return false
        if (
          url.searchParams.has("subcategory_name") &&
          row.subcategory !== url.searchParams.get("subcategory_name")
        )
          return false
        for (const field of ["is_basic", "is_preferred"] as const)
          if (
            ["true", "1"].includes(url.searchParams.get(field) ?? "") &&
            !row[field]
          )
            return false
        return true
      })
      .sort(
        (a, b) =>
          Number(b.mfr.toLowerCase() === query) -
            Number(a.mfr.toLowerCase() === query) ||
          (b.stock ?? -1) - (a.stock ?? -1) ||
          a.lcsc - b.lcsc,
      )
      .slice(0, Math.min(limit, 100))
    return new Response(
      request.method === "HEAD"
        ? null
        : JSON.stringify({ components: matches, catalog: metadata }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    )
  }
}

if (import.meta.main) {
  const handler = await createStandaloneJlcsearchHandler()
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: Number(process.env.PORT ?? 3080),
    fetch: handler,
  })
  console.log(`TSCIRCUIT_JLCSEARCH_BASE_URL=${server.url.origin}`)
}
