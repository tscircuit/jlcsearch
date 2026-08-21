import { fetchEasyEDAComponent } from "easyeda/browser";
import { addCorsHeaders } from "./cache-service";

export const EASYEDA_COMPONENTS_API_PREFIX = "/api/easyeda_components/";

const CACHE_SCHEMA_VERSION = 1;
const FOUND_TTL_MS = 90 * 24 * 60 * 60 * 1_000;
const NOT_FOUND_TTL_MS = 6 * 60 * 60 * 1_000;

interface FoundCacheEntry {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  status: "found";
  lcsc: number;
  fetchedAt: string;
  easyedaJson: unknown;
}

interface NotFoundCacheEntry {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  status: "not_found";
  lcsc: number;
  fetchedAt: string;
  reason: string;
}

type EasyEdaCacheEntry = FoundCacheEntry | NotFoundCacheEntry;

type EasyEdaCacheStatus = "R2-HIT" | "R2-MISS" | "R2-STALE";

const inFlightFills = new Map<number, Promise<EasyEdaCacheEntry>>();

const getCacheKey = (lcsc: number): string => `components/C${lcsc}.json`;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isPermanentNotFound = (message: string): boolean =>
  message === "Component not found" ||
  message.startsWith('No exact EasyEDA component match for "') ||
  message.includes("Failed to fetch the component details (HTTP 404)");

const getUpstreamStatus = (message: string): number => {
  const match = message.match(/HTTP (\d{3})/);
  const status = match ? Number(match[1]) : 502;
  return status >= 400 && status <= 599 ? status : 502;
};

const parseCacheEntry = (
  value: unknown,
  lcsc: number,
): EasyEdaCacheEntry | null => {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Partial<EasyEdaCacheEntry>;
  if (
    entry.schemaVersion !== CACHE_SCHEMA_VERSION ||
    entry.lcsc !== lcsc ||
    typeof entry.fetchedAt !== "string" ||
    !Number.isFinite(Date.parse(entry.fetchedAt))
  ) {
    return null;
  }
  if (entry.status === "found" && "easyedaJson" in entry) {
    return entry as FoundCacheEntry;
  }
  if (entry.status === "not_found" && typeof entry.reason === "string") {
    return entry as NotFoundCacheEntry;
  }
  return null;
};

const readCacheEntry = async (
  bucket: R2Bucket,
  lcsc: number,
): Promise<EasyEdaCacheEntry | null> => {
  const object = await bucket.get(getCacheKey(lcsc));
  if (!object) return null;
  try {
    return parseCacheEntry(JSON.parse(await object.text()), lcsc);
  } catch {
    return null;
  }
};

const isFresh = (entry: EasyEdaCacheEntry, now = Date.now()): boolean => {
  const ttl = entry.status === "found" ? FOUND_TTL_MS : NOT_FOUND_TTL_MS;
  return now - Date.parse(entry.fetchedAt) < ttl;
};

const writeCacheEntry = async (
  bucket: R2Bucket,
  entry: EasyEdaCacheEntry,
): Promise<void> => {
  await bucket.put(getCacheKey(entry.lcsc), JSON.stringify(entry), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      fetchedAt: entry.fetchedAt,
      lcsc: `C${entry.lcsc}`,
      schemaVersion: String(entry.schemaVersion),
      status: entry.status,
    },
  });
};

const fetchAndCacheEntry = async (
  bucket: R2Bucket,
  lcsc: number,
  upstreamFetch: typeof fetch,
): Promise<EasyEdaCacheEntry> => {
  try {
    const easyedaJson = await fetchEasyEDAComponent(`C${lcsc}`, {
      fetch: upstreamFetch,
      includeModelMetadata: false,
    });
    const entry: FoundCacheEntry = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      status: "found",
      lcsc,
      fetchedAt: new Date().toISOString(),
      easyedaJson,
    };
    await writeCacheEntry(bucket, entry);
    return entry;
  } catch (error) {
    const reason = getErrorMessage(error);
    if (!isPermanentNotFound(reason)) throw error;
    const entry: NotFoundCacheEntry = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      status: "not_found",
      lcsc,
      fetchedAt: new Date().toISOString(),
      reason,
    };
    await writeCacheEntry(bucket, entry);
    return entry;
  }
};

const fillCacheEntry = (
  bucket: R2Bucket,
  lcsc: number,
  upstreamFetch: typeof fetch,
): Promise<EasyEdaCacheEntry> => {
  const existing = inFlightFills.get(lcsc);
  if (existing) return existing;

  const fill = fetchAndCacheEntry(bucket, lcsc, upstreamFetch).finally(() => {
    inFlightFills.delete(lcsc);
  });
  inFlightFills.set(lcsc, fill);
  return fill;
};

const buildFoundResponse = (
  entry: FoundCacheEntry,
  cacheStatus: EasyEdaCacheStatus,
  origin: string | null,
): Response => {
  const raw = entry.easyedaJson as Record<string, unknown> | null;
  const headers = new Headers({
    "cache-control": "public, max-age=300",
    "content-type": "application/json",
    "x-cache": cacheStatus,
    "x-data-source": cacheStatus === "R2-MISS" ? "easyeda" : "r2",
  });
  addCorsHeaders(headers, origin);
  return new Response(
    JSON.stringify({
      easyeda_component_details: {
        lcsc: entry.lcsc,
        easyeda_uuid: raw && typeof raw.uuid === "string" ? raw.uuid : null,
        fetched_at: entry.fetchedAt,
        easyeda_json: entry.easyedaJson,
      },
    }),
    { status: 200, headers },
  );
};

const buildNotFoundResponse = (
  entry: NotFoundCacheEntry,
  cacheStatus: EasyEdaCacheStatus,
  origin: string | null,
): Response => {
  const headers = new Headers({
    "cache-control": "public, max-age=60",
    "content-type": "application/json",
    "x-cache": cacheStatus,
    "x-data-source": cacheStatus === "R2-MISS" ? "easyeda" : "r2",
  });
  addCorsHeaders(headers, origin);
  return new Response(
    JSON.stringify({
      easyeda_component_details: {
        lcsc: entry.lcsc,
        easyeda_uuid: null,
        fetched_at: entry.fetchedAt,
        easyeda_json: null,
      },
      error: {
        error_code: "component_not_found",
        message: entry.reason,
      },
    }),
    { status: 404, headers },
  );
};

const buildCacheMissResponse = (
  lcsc: number,
  origin: string | null,
): Response => {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-cache": "R2-MISS",
    "x-data-source": "r2",
  });
  addCorsHeaders(headers, origin);
  return new Response(
    JSON.stringify({
      error: {
        error_code: "cache_miss",
        message: `No fresh EasyEDA cache entry exists for C${lcsc}`,
      },
    }),
    { status: 404, headers },
  );
};

const buildUpstreamErrorResponse = (
  lcsc: number,
  error: unknown,
  origin: string | null,
): Response => {
  const message = getErrorMessage(error);
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-cache": "R2-MISS",
    "x-data-source": "easyeda",
  });
  addCorsHeaders(headers, origin);
  return new Response(
    JSON.stringify({
      error: {
        error_code: "easyeda_fetch_failed",
        message: `Failed to fill the EasyEDA cache for C${lcsc}: ${message}`,
      },
    }),
    { status: getUpstreamStatus(message), headers },
  );
};

const parseLcsc = (pathname: string): number | null => {
  const rawLcsc = pathname.slice(EASYEDA_COMPONENTS_API_PREFIX.length);
  const normalizedLcsc = rawLcsc.replace(/^c/i, "");
  if (!/^\d+$/.test(normalizedLcsc)) return null;
  const lcsc = Number(normalizedLcsc);
  return Number.isSafeInteger(lcsc) && lcsc > 0 ? lcsc : null;
};

export async function handleEasyEdaComponentCache(
  url: URL,
  bucket: R2Bucket,
  origin: string | null,
  upstreamFetch: typeof fetch = fetch,
): Promise<Response | null> {
  if (!url.pathname.startsWith(EASYEDA_COMPONENTS_API_PREFIX)) return null;

  const lcsc = parseLcsc(url.pathname);
  if (lcsc === null) {
    const headers = new Headers({
      "cache-control": "no-store",
      "content-type": "application/json",
    });
    addCorsHeaders(headers, origin);
    return new Response(
      JSON.stringify({
        error: {
          error_code: "invalid_lcsc",
          message: "LCSC must be a positive integer with an optional C prefix",
        },
      }),
      { status: 400, headers },
    );
  }

  const cachedEntry = await readCacheEntry(bucket, lcsc);
  if (cachedEntry && isFresh(cachedEntry)) {
    return cachedEntry.status === "found"
      ? buildFoundResponse(cachedEntry, "R2-HIT", origin)
      : buildNotFoundResponse(cachedEntry, "R2-HIT", origin);
  }

  if (url.searchParams.get("cache_only") === "true") {
    return buildCacheMissResponse(lcsc, origin);
  }

  try {
    const entry = await fillCacheEntry(bucket, lcsc, upstreamFetch);
    return entry.status === "found"
      ? buildFoundResponse(entry, "R2-MISS", origin)
      : buildNotFoundResponse(entry, "R2-MISS", origin);
  } catch (error) {
    if (cachedEntry?.status === "found") {
      return buildFoundResponse(cachedEntry, "R2-STALE", origin);
    }
    return buildUpstreamErrorResponse(lcsc, error, origin);
  }
}
