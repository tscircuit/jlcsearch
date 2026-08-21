import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleEasyEdaComponentCache } from "../src/easyeda-component-cache";
import { MemoryR2 } from "./test-env";

const searchPayload = (lcsc: string, uuid = "easyeda-uuid") => ({
  success: true,
  result: {
    lists: {
      lcsc: [{ uuid, lcsc: { number: lcsc } }],
    },
  },
});

describe("EasyEDA R2 component cache", () => {
  let bucket: MemoryR2;

  beforeEach(() => {
    bucket = new MemoryR2();
  });

  it("fills R2 on a miss and serves the next request without EasyEDA", async () => {
    const upstreamFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.endsWith("/api/components/search")) {
        return Response.json(searchPayload("C123"));
      }
      return Response.json({
        result: { uuid: "easyeda-uuid", lcsc: { number: "C123" } },
      });
    });

    const first = await handleEasyEdaComponentCache(
      new URL("https://example.com/api/easyeda_components/C123"),
      bucket as unknown as R2Bucket,
      null,
      upstreamFetch as unknown as typeof fetch,
    );
    expect(first?.status).toBe(200);
    expect(first?.headers.get("x-cache")).toBe("R2-MISS");
    expect(upstreamFetch).toHaveBeenCalledTimes(2);
    expect(await first?.json()).toEqual({
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

    upstreamFetch.mockClear();
    const second = await handleEasyEdaComponentCache(
      new URL("https://example.com/api/easyeda_components/123?cache_only=true"),
      bucket as unknown as R2Bucket,
      null,
      upstreamFetch as unknown as typeof fetch,
    );
    expect(second?.status).toBe(200);
    expect(second?.headers.get("x-cache")).toBe("R2-HIT");
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("returns an R2-only miss without calling EasyEDA", async () => {
    const upstreamFetch = vi.fn();
    const response = await handleEasyEdaComponentCache(
      new URL(
        "https://example.com/api/easyeda_components/C456?cache_only=true",
      ),
      bucket as unknown as R2Bucket,
      null,
      upstreamFetch as unknown as typeof fetch,
    );

    expect(response?.status).toBe(404);
    expect(response?.headers.get("x-cache")).toBe("R2-MISS");
    expect(await response?.json()).toEqual({
      error: {
        error_code: "cache_miss",
        message: "No fresh EasyEDA cache entry exists for C456",
      },
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("negative-caches permanent component misses", async () => {
    const upstreamFetch = vi.fn(async () =>
      Response.json({ success: true, result: { lists: { lcsc: [] } } }),
    );

    const first = await handleEasyEdaComponentCache(
      new URL("https://example.com/api/easyeda_components/C789"),
      bucket as unknown as R2Bucket,
      null,
      upstreamFetch as unknown as typeof fetch,
    );
    expect(first?.status).toBe(404);
    expect(first?.headers.get("x-cache")).toBe("R2-MISS");
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
    const firstBody = (await first?.json()) as {
      error: { error_code: string; message: string };
    };
    expect(firstBody.error).toEqual({
      error_code: "component_not_found",
      message: "Component not found",
    });

    upstreamFetch.mockClear();
    const second = await handleEasyEdaComponentCache(
      new URL("https://example.com/api/easyeda_components/C789"),
      bucket as unknown as R2Bucket,
      null,
      upstreamFetch as unknown as typeof fetch,
    );
    expect(second?.status).toBe(404);
    expect(second?.headers.get("x-cache")).toBe("R2-HIT");
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("preserves EasyEDA 403 responses for caller-side cooldowns", async () => {
    const upstreamFetch = vi.fn(
      async () => new Response("rate limited", { status: 403 }),
    );

    const response = await handleEasyEdaComponentCache(
      new URL("https://example.com/api/easyeda_components/C999"),
      bucket as unknown as R2Bucket,
      null,
      upstreamFetch as unknown as typeof fetch,
    );
    expect(response?.status).toBe(403);
    const responseBody = (await response?.json()) as {
      error: { error_code: string };
    };
    expect(responseBody.error.error_code).toBe("easyeda_fetch_failed");

    upstreamFetch.mockClear();
    const probe = await handleEasyEdaComponentCache(
      new URL(
        "https://example.com/api/easyeda_components/C999?cache_only=true",
      ),
      bucket as unknown as R2Bucket,
      null,
      upstreamFetch as unknown as typeof fetch,
    );
    const probeBody = (await probe?.json()) as {
      error: { error_code: string };
    };
    expect(probeBody.error.error_code).toBe("cache_miss");
  });
});
