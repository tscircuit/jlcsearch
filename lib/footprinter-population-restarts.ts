export const POPULATION_BATCH_COMPONENT_LIMIT = 1_000
export const POPULATION_BATCH_RESTART_EXIT_CODE = 75
export const POPULATION_WASM_RESTART_EXIT_CODE = 76
export const RAPID_WASM_RESTART_LIMIT = 3
export const RAPID_WASM_RESTART_THRESHOLD_MS = 30_000
export const SUPERVISOR_DEADLINE_BUFFER_MS = 45_000
export const WASM_RESTART_DELAY_MS = 1_000

export const isManifoldWasmAbort = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.startsWith("Aborted(") &&
    message.includes("Build with -sASSERTIONS")
  )
}
