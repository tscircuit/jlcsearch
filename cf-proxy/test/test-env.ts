import worker from "../src/index"

type KVValue = { value: string | null; metadata: unknown }

export class MemoryKV {
  private store = new Map<string, KVValue>()

  async get(key: string | string[], _typeOrOptions?: any): Promise<any> {
    if (Array.isArray(key)) {
      return key.reduce<Record<string, string | null>>((acc, item) => {
        acc[item] = this.store.get(item)?.value ?? null
        return acc
      }, {})
    }
    return this.store.get(key)?.value ?? null
  }

  async getWithMetadata<T>(
    key: string | string[],
    _typeOrOptions?: any,
  ): Promise<any> {
    if (Array.isArray(key)) {
      return key.reduce<Record<string, { value: string | null; metadata: T | null; cacheStatus: null }>>(
        (acc, item) => {
          const entry = this.store.get(item)
          acc[item] = {
            value: entry?.value ?? null,
            metadata: (entry?.metadata as T) ?? null,
            cacheStatus: null,
          }
          return acc
        },
        {},
      )
    }
    const entry = this.store.get(key)
    if (!entry) {
      return { value: null, metadata: null, cacheStatus: null }
    }
    return {
      value: entry.value,
      metadata: entry.metadata as T,
      cacheStatus: null,
    }
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

  async list(): Promise<{
    keys: Array<{ name: string }>
    list_complete: true
    cacheStatus: null
  }> {
    return {
      keys: Array.from(this.store.keys()).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    }
  }
}

export const createTestEnv = () => ({
  CACHE_KV: new MemoryKV(),
  ORIGIN_URL: "https://example.com",
  USE_D1: "false",
  DB: {} as D1Database,
})

export const createSelf = (env: ReturnType<typeof createTestEnv>) => ({
  pending: [] as Promise<unknown>[],
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return worker.fetch(new Request(input, init), env, {
      waitUntil: (promise: Promise<unknown>) => {
        this.pending.push(promise)
      },
      passThroughOnException: () => {},
    } as ExecutionContext)
  },
  async flushWaitUntil() {
    await Promise.allSettled(this.pending)
    this.pending.length = 0
  },
})
