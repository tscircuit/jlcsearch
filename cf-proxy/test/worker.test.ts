import { beforeEach, describe, expect, it } from "vitest";
import { generateCacheKey } from "../src/cache-key";
import {
  createFootprinterStringsD1,
  createSelf,
  createTestEnv,
} from "./test-env";

describe("Worker integration", () => {
  const env = createTestEnv();
  const SELF = createSelf(env);

  beforeEach(async () => {
    env.USE_D1 = "false";
    env.DB = createFootprinterStringsD1([]);

    const keys = await env.CACHE_KV.list();
    for (const key of keys.keys) {
      await env.CACHE_KV.delete(key.name);
    }
    await env.EASYEDA_COMPONENT_CACHE.clear();
  });

  it("serves /health directly from the worker", async () => {
    const response = await SELF.fetch("https://example.com/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-cache")).toBeNull();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 405 for unsupported non-GET methods", async () => {
    const response = await SELF.fetch("https://example.com/components/list", {
      method: "POST",
      headers: { accept: "application/json" },
    });

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      error: {
        error_code: "method_not_allowed",
        message: "Method Not Allowed",
      },
    });
  });

  it("returns worker 404 for unknown list routes", async () => {
    env.USE_D1 = "true";

    const response = await SELF.fetch("https://example.com/not-found/list", {
      headers: { accept: "application/json" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("x-data-source")).toBe("d1");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        error_code: "not_found",
        message: "Not Found",
      },
    });
  });

  it("returns worker 404 for unknown non-list routes", async () => {
    env.USE_D1 = "true";

    const response = await SELF.fetch("https://example.com/nope", {
      headers: { accept: "application/json" },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        error_code: "not_found",
        message: "Not Found",
      },
    });
  });

  it("returns component footprinter details for a C-prefixed LCSC", async () => {
    env.USE_D1 = "true";
    env.DB = createFootprinterStringsD1([
      {
        lcsc: 2906861,
        footprinter_string: "sod723_p0.865mm_pw0.54mm_pl0.57mm",
        copper_iou: 0.9923751612092405,
        updated_at: "2026-08-12 04:34:12",
      },
    ]);

    const response = await SELF.fetch(
      "https://example.com/api/footprinter_strings/C2906861",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-cache")).toBe("D1");
    expect(await response.json()).toEqual({
      component_footprinter_details: {
        lcsc: 2906861,
        footprinter_string: "sod723_p0.865mm_pw0.54mm_pl0.57mm",
        copper_iou: 0.9923751612092405,
        updated_at: "2026-08-12 04:34:12",
      },
    });
  });

  it("serves EasyEDA component JSON from the shared R2 cache", async () => {
    await env.EASYEDA_COMPONENT_CACHE.put(
      "components/C123.json",
      JSON.stringify({
        schemaVersion: 1,
        status: "found",
        lcsc: 123,
        fetchedAt: new Date().toISOString(),
        easyedaJson: {
          uuid: "easyeda-uuid",
          lcsc: { number: "C123" },
        },
      }),
    );

    const response = await SELF.fetch(
      "https://example.com/api/easyeda_components/C123?cache_only=true",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-cache")).toBe("R2-HIT");
    expect(response.headers.get("x-data-source")).toBe("r2");
    expect(await response.json()).toEqual({
      easyeda_component_details: {
        lcsc: 123,
        easyeda_uuid: "easyeda-uuid",
        fetched_at: expect.any(String),
        easyeda_json: {
          uuid: "easyeda-uuid",
          lcsc: { number: "C123" },
        },
      },
    });
  });

  it("returns a processed nullable footprinter row for a numeric LCSC", async () => {
    env.USE_D1 = "true";
    env.DB = createFootprinterStringsD1([
      {
        lcsc: 123,
        footprinter_string: null,
        copper_iou: 0.94,
        updated_at: "2026-08-12 05:00:00",
      },
    ]);

    const response = await SELF.fetch(
      "https://example.com/api/footprinter_strings/123",
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      component_footprinter_details: {
        lcsc: 123,
        footprinter_string: null,
        copper_iou: 0.94,
        updated_at: "2026-08-12 05:00:00",
      },
    });
  });

  it("returns 404 when an LCSC has not been processed", async () => {
    env.USE_D1 = "true";

    const response = await SELF.fetch(
      "https://example.com/api/footprinter_strings/C404",
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        error_code: "not_found",
        message: "Not Found",
      },
    });
  });

  it("returns 400 for an invalid footprinter LCSC", async () => {
    env.USE_D1 = "true";

    const response = await SELF.fetch(
      "https://example.com/api/footprinter_strings/not-an-lcsc",
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: {
        error_code: "invalid_lcsc",
        message: "LCSC must be a positive integer with an optional C prefix",
      },
    });
  });

  it("serves cached D1 derived-table HTML from KV", async () => {
    env.USE_D1 = "true";

    const url = new URL(
      "https://example.com/microcontrollers/list?package=QFN48",
    );
    url.searchParams.set("__format", "html");
    const cacheKey = await generateCacheKey(url);

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        vary: "Accept",
        "x-data-source": "d1",
      },
    };
    const testBody = "<html><body>cached microcontrollers page</body></html>";

    await env.CACHE_KV.put(cacheKey, testBody, { metadata });

    const response = await SELF.fetch(
      "https://example.com/microcontrollers/list?package=QFN48",
    );

    expect(response.headers.get("x-cache")).toBe("HIT");
    expect(response.headers.get("x-data-source")).toBe("d1");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("vary")).toContain("Accept");
    expect(await response.text()).toBe(testBody);
  });

  it("serves cached custom D1 route HTML from KV", async () => {
    env.USE_D1 = "true";

    const url = new URL(
      "https://example.com/risc_v_processors/list?package=QFN48",
    );
    url.searchParams.set("__format", "html");
    const cacheKey = await generateCacheKey(url);

    await env.CACHE_KV.put(
      cacheKey,
      "<html><body>cached risc-v page</body></html>",
      {
        metadata: {
          cachedAt: new Date().toISOString(),
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            vary: "Accept",
            "x-data-source": "d1",
          },
        },
      },
    );

    const response = await SELF.fetch(
      "https://example.com/risc_v_processors/list?package=QFN48",
    );

    expect(response.headers.get("x-cache")).toBe("HIT");
    expect(response.headers.get("x-data-source")).toBe("d1");
    expect(await response.text()).toContain("cached risc-v page");
  });

  it("serves stale cached D1 derived-table HTML when refresh fails", async () => {
    env.USE_D1 = "true";

    const staleAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const url = new URL(
      "https://example.com/microcontrollers/list?package=QFN48",
    );
    url.searchParams.set("__format", "html");
    const cacheKey = await generateCacheKey(url);

    await env.CACHE_KV.put(
      cacheKey,
      "<html><body>stale microcontrollers page</body></html>",
      {
        metadata: {
          cachedAt: staleAt.toISOString(),
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            vary: "Accept",
            "x-data-source": "d1",
          },
        },
      },
    );

    const response = await SELF.fetch(
      "https://example.com/microcontrollers/list?package=QFN48",
    );

    expect(response.headers.get("x-cache")).toBe("STALE");
    expect(response.headers.get("x-data-source")).toBe("d1");
    expect(await response.text()).toContain("stale microcontrollers page");

    await SELF.flushWaitUntil();
  });

  it("serves cached D1 components HTML from KV", async () => {
    env.USE_D1 = "true";

    const url = new URL("https://example.com/components/list?search=TYPEC");
    url.searchParams.set("__format", "html");
    const cacheKey = await generateCacheKey(url);

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    };
    const testBody = "<html><body>cached components page</body></html>";

    await env.CACHE_KV.put(cacheKey, testBody, { metadata });

    const response = await SELF.fetch(
      "https://example.com/components/list?search=TYPEC",
    );

    expect(response.headers.get("x-cache")).toBe("HIT");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe(testBody);
  });

  it("serves cached D1 components JSON from KV", async () => {
    env.USE_D1 = "true";

    const url = new URL("https://example.com/components/list?search=TYPEC");
    url.searchParams.set("__format", "json");
    const cacheKey = await generateCacheKey(url);

    const metadata = {
      cachedAt: new Date().toISOString(),
      status: 200,
      headers: { "content-type": "application/json" },
    };
    const testBody = '{"components":[{"lcsc":1}]}';

    await env.CACHE_KV.put(cacheKey, testBody, { metadata });

    const response = await SELF.fetch(
      "https://example.com/components/list?search=TYPEC",
      { headers: { accept: "application/json" } },
    );

    expect(response.headers.get("x-cache")).toBe("HIT");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.text()).toBe(testBody);
  });

  it("serves the homepage with one-hour caching without using KV", async () => {
    env.USE_D1 = "true";

    const url = new URL("https://example.com/");
    const cacheKey = await generateCacheKey(url);
    const staleBody = "<html><body>stale home page</body></html>";

    await env.CACHE_KV.put(cacheKey, staleBody, {
      metadata: {
        cachedAt: new Date().toISOString(),
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    });

    const response = await SELF.fetch("https://example.com/");
    const body = await response.text();

    expect(response.headers.get("x-cache")).toBe("D1");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=3600, must-revalidate",
    );
    expect(body).not.toContain(staleBody);
    expect(body).toContain("JLCPCB In-Stock Parts Engine");
  });

  it("disables homepage caching when cachebust=1 is present", async () => {
    env.USE_D1 = "true";

    const bustedResponse = await SELF.fetch("https://example.com/?cachebust=1");
    const bustedBody = await bustedResponse.text();

    expect(bustedResponse.headers.get("x-cache")).toBe("D1");
    expect(bustedResponse.headers.get("x-cache-bust")).toBe("1");
    expect(bustedResponse.headers.get("cache-control")).toBe("no-store");
    expect(bustedBody).toContain("JLCPCB In-Stock Parts Engine");
  });

  it("handles different cache key for different query params", async () => {
    env.USE_D1 = "true";

    const url1 = new URL("https://example.com/components/list?search=test");
    url1.searchParams.set("__format", "json");
    const url2 = new URL("https://example.com/components/list?search=other");
    url2.searchParams.set("__format", "json");

    const cacheKey1 = await generateCacheKey(url1);
    const cacheKey2 = await generateCacheKey(url2);

    await env.CACHE_KV.put(cacheKey1, '{"q":"test"}', {
      metadata: {
        cachedAt: new Date().toISOString(),
        status: 200,
        headers: { "content-type": "application/json" },
      },
    });

    const response1 = await SELF.fetch(
      "https://example.com/components/list?search=test",
      { headers: { accept: "application/json" } },
    );
    expect(response1.headers.get("x-cache")).toBe("HIT");
    expect(await response1.text()).toBe('{"q":"test"}');

    expect(cacheKey1).not.toBe(cacheKey2);
  });
});
