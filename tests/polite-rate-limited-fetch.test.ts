import { describe, expect, test } from "bun:test";
import {
  PoliteRateLimitedFetch,
  RequestDeadlineReachedError,
  type PoliteRateLimitedFetchMetrics,
} from "../lib/polite-rate-limited-fetch";

const createMetrics = (): PoliteRateLimitedFetchMetrics => ({
  cooldownCount: 0,
  requestCount: 0,
  requestDurationMs: 0,
  throttleWaitMs: 0,
});

describe("PoliteRateLimitedFetch", () => {
  test("paces concurrent request starts through one shared queue", async () => {
    const requestStarts: number[] = [];
    const limiter = new PoliteRateLimitedFetch({
      cooldownMs: 100,
      cooldownRequestsPerSecond: 20,
      deadline: Date.now() + 2_000,
      fetch: async () => {
        requestStarts.push(Date.now());
        return new Response("{}");
      },
      metrics: createMetrics(),
      requestsPerSecond: 20,
      signal: new AbortController().signal,
    });

    await Promise.all([
      limiter.fetch("https://example.com/1"),
      limiter.fetch("https://example.com/2"),
      limiter.fetch("https://example.com/3"),
    ]);

    expect(requestStarts).toHaveLength(3);
    expect(requestStarts[1] - requestStarts[0]).toBeGreaterThanOrEqual(40);
    expect(requestStarts[2] - requestStarts[1]).toBeGreaterThanOrEqual(40);
  });

  test("globally cools down and slows subsequent requests after a 403", async () => {
    const metrics = createMetrics();
    const requestStarts: number[] = [];
    let requestNumber = 0;
    const limiter = new PoliteRateLimitedFetch({
      cooldownMs: 80,
      cooldownRequestsPerSecond: 10,
      deadline: Date.now() + 2_000,
      fetch: async () => {
        requestStarts.push(Date.now());
        requestNumber += 1;
        if (requestNumber === 1) await Bun.sleep(10);
        return new Response("{}", { status: requestNumber === 1 ? 403 : 200 });
      },
      metrics,
      requestsPerSecond: 20,
      signal: new AbortController().signal,
    });

    await Promise.all([
      limiter.fetch("https://example.com/limited"),
      limiter.fetch("https://example.com/queued-before-cooldown"),
    ]);
    await limiter.fetch("https://example.com/slower");

    expect(metrics.cooldownCount).toBe(1);
    expect(requestStarts[1] - requestStarts[0]).toBeGreaterThanOrEqual(70);
    expect(requestStarts[2] - requestStarts[1]).toBeGreaterThanOrEqual(90);
  });

  test("does not start a request at or beyond its deadline", async () => {
    const limiter = new PoliteRateLimitedFetch({
      cooldownMs: 100,
      cooldownRequestsPerSecond: 10,
      deadline: Date.now(),
      fetch,
      metrics: createMetrics(),
      requestsPerSecond: 20,
      signal: new AbortController().signal,
    });

    await expect(limiter.fetch("https://example.com")).rejects.toBeInstanceOf(
      RequestDeadlineReachedError,
    );
  });
});
