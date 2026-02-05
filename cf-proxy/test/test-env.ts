import worker from "../src/index"

type KVValue = { value: string | null; metadata: unknown }

export class MemoryKV {
  private store = new Map<string, KVValue>()

  async getWithMetadata<T>(
    key: string,
    _type: "text",
  ): Promise<{ value: string | null; metadata: T | null }> {
    const entry = this.store.get(key)
    if (!entry) {
      return { value: null, metadata: null }
    }
    return { value: entry.value, metadata: entry.metadata as T }
  }

  async put(
    key: string,
    value: string,
    options?: { metadata?: unknown },
  ): Promise<void> {
    this.store.set(key, { value, metadata: options?.metadata ?? null })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async list(): Promise<{ keys: Array<{ name: string }> }> {
    return { keys: Array.from(this.store.keys()).map((name) => ({ name })) }
  }
}

export const createTestEnv = () => ({
  CACHE_KV: new MemoryKV(),
  ORIGIN_URL: "https://example.com",
})

export const createSelf = (env: ReturnType<typeof createTestEnv>) => ({
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    worker.fetch(new Request(input, init), env, {
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as ExecutionContext),
})
