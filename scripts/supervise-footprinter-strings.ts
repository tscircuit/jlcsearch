import { join } from "node:path";
import {
  POPULATION_BATCH_COMPONENT_LIMIT,
  POPULATION_BATCH_RESTART_EXIT_CODE,
  POPULATION_WASM_RESTART_EXIT_CODE,
  RAPID_WASM_RESTART_LIMIT,
  RAPID_WASM_RESTART_THRESHOLD_MS,
  SUPERVISOR_DEADLINE_BUFFER_MS,
  WASM_RESTART_DELAY_MS,
} from "../lib/footprinter-population-restarts";

const DEFAULT_RUNTIME_MINUTES = 240;
const WORKER_SCRIPT = join(import.meta.dir, "populate-footprinter-strings.ts");

export interface PopulationSupervisorOptions {
  maxRuntimeMinutes: number;
  retryNullEntries: boolean;
}

export interface PopulationBatchOptions extends PopulationSupervisorOptions {
  maxComponents: number;
  restartOnLimit: boolean;
}

interface PopulationSupervisorDependencies {
  now: () => number;
  runBatch: (options: PopulationBatchOptions) => Promise<number>;
  sleep: (durationMs: number) => Promise<void>;
}

const parsePositiveInteger = (value: string, name: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

export const parseSupervisorOptions = (
  args: readonly string[],
): PopulationSupervisorOptions => {
  const options: PopulationSupervisorOptions = {
    maxRuntimeMinutes: DEFAULT_RUNTIME_MINUTES,
    retryNullEntries: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--retry-null-entries") {
      options.retryNullEntries = true;
      continue;
    }

    const value = args[index + 1];
    if (!value) throw new Error(`Missing value for ${argument}`);

    if (argument !== "--max-runtime-minutes") {
      throw new Error(`Unknown argument: ${argument}`);
    }
    options.maxRuntimeMinutes = parsePositiveInteger(value, argument);
    if (options.maxRuntimeMinutes > DEFAULT_RUNTIME_MINUTES) {
      throw new Error(
        `--max-runtime-minutes cannot exceed ${DEFAULT_RUNTIME_MINUTES}`,
      );
    }
    index += 1;
  }

  return options;
};

const sleep = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const runBatch = async (options: PopulationBatchOptions): Promise<number> => {
  const args = [
    "bun",
    "run",
    WORKER_SCRIPT,
    "--max-runtime-minutes",
    String(options.maxRuntimeMinutes),
    "--max-components",
    String(options.maxComponents),
  ];
  if (options.restartOnLimit) args.push("--restart-on-limit");
  if (options.retryNullEntries) args.push("--retry-null-entries");

  const child = Bun.spawn(args, {
    env: process.env,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  return child.exited;
};

const defaultDependencies: PopulationSupervisorDependencies = {
  now: Date.now,
  runBatch,
  sleep,
};

export const superviseFootprinterPopulation = async (
  options: PopulationSupervisorOptions,
  dependencies: PopulationSupervisorDependencies = defaultDependencies,
): Promise<void> => {
  const deadline = dependencies.now() + options.maxRuntimeMinutes * 60_000;
  let rapidWasmRestarts = 0;
  let batchNumber = 0;

  while (true) {
    const remainingRuntimeMs = deadline - dependencies.now();
    if (remainingRuntimeMs <= SUPERVISOR_DEADLINE_BUFFER_MS) {
      console.log("Supervisor runtime reached; exiting cleanly.");
      return;
    }
    const remainingRuntimeMinutes = Math.ceil(
      (remainingRuntimeMs - SUPERVISOR_DEADLINE_BUFFER_MS) / 60_000,
    );

    batchNumber += 1;
    console.log(
      `Starting footprinter population batch ${batchNumber} with up to ${POPULATION_BATCH_COMPONENT_LIMIT} components and ${remainingRuntimeMinutes} minute(s) remaining.`,
    );
    const batchStartedAt = dependencies.now();
    const exitCode = await dependencies.runBatch({
      maxComponents: POPULATION_BATCH_COMPONENT_LIMIT,
      maxRuntimeMinutes: remainingRuntimeMinutes,
      restartOnLimit: true,
      retryNullEntries: options.retryNullEntries,
    });
    const batchDurationMs = dependencies.now() - batchStartedAt;

    if (exitCode === 0) {
      console.log("Population worker finished without requesting a restart.");
      return;
    }

    if (exitCode === POPULATION_BATCH_RESTART_EXIT_CODE) {
      rapidWasmRestarts = 0;
      console.log(
        `Population batch reached its component limit; starting with a fresh WASM runtime.`,
      );
      continue;
    }

    if (exitCode === POPULATION_WASM_RESTART_EXIT_CODE) {
      rapidWasmRestarts =
        batchDurationMs < RAPID_WASM_RESTART_THRESHOLD_MS
          ? rapidWasmRestarts + 1
          : 1;
      if (rapidWasmRestarts >= RAPID_WASM_RESTART_LIMIT) {
        throw new Error(
          `Manifold WASM aborted ${rapidWasmRestarts} times in rapid succession; stopping instead of retrying indefinitely.`,
        );
      }
      console.warn(
        `Population worker detected a poisoned Manifold WASM runtime; restarting in ${WASM_RESTART_DELAY_MS}ms.`,
      );
      await dependencies.sleep(WASM_RESTART_DELAY_MS);
      continue;
    }

    throw new Error(`Population worker exited with code ${exitCode}`);
  }
};

if (import.meta.main) {
  await superviseFootprinterPopulation(
    parseSupervisorOptions(Bun.argv.slice(2)),
  );
}
