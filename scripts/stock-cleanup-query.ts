type QueryFetch = (
  ...args: Parameters<typeof fetch>
) => ReturnType<typeof fetch>

type CleanupQueryOptions = {
  accountId: string
  databaseId: string
  apiToken: string
  fetcher?: QueryFetch
  pause?: (ms: number) => Promise<unknown>
}

// Cleanup uses only reads and repeatable, guarded writes. Its small statements
// belong on /query, never Wrangler's --file /import path, which blocks D1.
export function createStockCleanupQuery({
  accountId,
  databaseId,
  apiToken,
  fetcher = fetch,
  pause = (ms) => Bun.sleep(ms),
}: CleanupQueryOptions) {
  if (
    !/^[a-f0-9]{32}$/i.test(accountId) ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(databaseId) ||
    !apiToken.trim()
  ) {
    throw new Error("Missing or invalid D1 cleanup credentials/database ID")
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`
  return async (sql: string): Promise<any[]> => {
    for (let attempt = 1; ; attempt++) {
      let retryable = true
      try {
        const response = await fetcher(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sql }),
          signal: AbortSignal.timeout(30_000),
        })
        retryable =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500
        const body: any = await response.json()
        if (
          response.ok &&
          body.success === true &&
          Array.isArray(body.result) &&
          body.result.length > 0 &&
          body.result.every(
            (r: any) => r?.success === true && Array.isArray(r.results),
          )
        ) {
          return body.result.flatMap((r: any) => r.results)
        }
        const errors = [
          ...(Array.isArray(body.errors) ? body.errors : []),
          ...(Array.isArray(body.result)
            ? body.result.filter((r: any) => r?.success !== true)
            : []),
        ]
        const message = errors
          .map((e: any) => e?.message || e?.error || "")
          .join("; ")
          .slice(0, 500)
        retryable ||=
          errors.some((e: any) => e?.code === 7429) ||
          /overloaded|Too many resources consumed/i.test(message)
        throw new Error(
          `D1 cleanup query failed (HTTP ${response.status})${message ? `: ${message}` : ": invalid response"}`,
        )
      } catch (error) {
        if (!retryable || attempt >= 3) throw error
        await pause(30_000 * attempt)
      }
    }
  }
}

export async function stockCleanupQueryFromEnv(
  env: Record<string, string | undefined> = process.env,
  fetcher: QueryFetch = fetch,
) {
  const config = Bun.TOML.parse(
    await Bun.file(
      new URL("../cf-proxy/wrangler.toml", import.meta.url),
    ).text(),
  ) as { d1_databases?: { database_name: string; database_id: string }[] }
  const name = env.DB_NAME || "jlcsearch"
  const database = config.d1_databases?.find((db) => db.database_name === name)
  if (!database)
    throw new Error(`No configured D1 cleanup database named ${name}`)
  return createStockCleanupQuery({
    accountId: env.CLOUDFLARE_ACCOUNT_ID || "",
    databaseId: database.database_id,
    apiToken: env.CLOUDFLARE_API_TOKEN || "",
    fetcher,
  })
}
