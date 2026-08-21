import { describe, expect, test } from "bun:test";
import {
  POPULATION_BATCH_COMPONENT_LIMIT,
  POPULATION_BATCH_RESTART_EXIT_CODE,
  POPULATION_WASM_RESTART_EXIT_CODE,
  RAPID_WASM_RESTART_LIMIT,
  WASM_RESTART_DELAY_MS,
  isManifoldWasmAbort,
} from "../lib/footprinter-population-restarts";
import {
  parseSupervisorOptions,
  superviseFootprinterPopulation,
  type PopulationBatchOptions,
} from "../scripts/supervise-footprinter-strings";

describe("footprinter population restarts", () => {
  test("recognizes an Emscripten Manifold abort", () => {
    expect(
      isManifoldWasmAbort(
        new WebAssembly.RuntimeError(
          "Aborted(). Build with -sASSERTIONS for more info.",
        ),
      ),
    ).toBe(true);
    expect(isManifoldWasmAbort(new Error("The operation was aborted"))).toBe(
      false,
    );
  });

  test("parses workflow options", () => {
    expect(
      parseSupervisorOptions([
        "--max-runtime-minutes",
        "120",
        "--retry-null-entries",
      ]),
    ).toEqual({ maxRuntimeMinutes: 120, retryNullEntries: true });
  });

  test("starts fresh workers after each planned batch", async () => {
    let currentTime = 0;
    const batchOptions: PopulationBatchOptions[] = [];
    const exitCodes = [
      POPULATION_BATCH_RESTART_EXIT_CODE,
      POPULATION_BATCH_RESTART_EXIT_CODE,
      0,
    ];

    await superviseFootprinterPopulation(
      { maxRuntimeMinutes: 10, retryNullEntries: false },
      {
        now: () => currentTime,
        runBatch: async (options) => {
          batchOptions.push(options);
          currentTime += 60_000;
          return exitCodes.shift() ?? 0;
        },
        sleep: async () => {},
      },
    );

    expect(batchOptions).toHaveLength(3);
    expect(batchOptions[0]).toMatchObject({
      maxComponents: POPULATION_BATCH_COMPONENT_LIMIT,
      maxRuntimeMinutes: 10,
      restartOnLimit: true,
    });
    expect(batchOptions[1]?.maxRuntimeMinutes).toBe(9);
  });

  test("restarts after a WASM abort with a short delay", async () => {
    let currentTime = 0;
    const sleeps: number[] = [];
    const exitCodes = [POPULATION_WASM_RESTART_EXIT_CODE, 0];

    await superviseFootprinterPopulation(
      { maxRuntimeMinutes: 10, retryNullEntries: false },
      {
        now: () => currentTime,
        runBatch: async () => exitCodes.shift() ?? 0,
        sleep: async (durationMs) => {
          sleeps.push(durationMs);
          currentTime += durationMs;
        },
      },
    );

    expect(sleeps).toEqual([WASM_RESTART_DELAY_MS]);
  });

  test("stops a rapid WASM restart storm", async () => {
    let attempts = 0;

    await expect(
      superviseFootprinterPopulation(
        { maxRuntimeMinutes: 10, retryNullEntries: false },
        {
          now: () => 0,
          runBatch: async () => {
            attempts += 1;
            return POPULATION_WASM_RESTART_EXIT_CODE;
          },
          sleep: async () => {},
        },
      ),
    ).rejects.toThrow("stopping instead of retrying indefinitely");
    expect(attempts).toBe(RAPID_WASM_RESTART_LIMIT);
  });
});
