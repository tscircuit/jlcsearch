import worker from "../src/index"

type KVValue = { value: string | null; metadata: unknown }
type R2Value = {
  body: string
  customMetadata?: Record<string, string>
  uploaded: Date
}

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
      return key.reduce<
        Record<
          string,
          { value: string | null; metadata: T | null; cacheStatus: null }
        >
      >((acc, item) => {
        const entry = this.store.get(item)
        acc[item] = {
          value: entry?.value ?? null,
          metadata: (entry?.metadata as T) ?? null,
          cacheStatus: null,
        }
        return acc
      }, {})
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

export class MemoryR2 {
  private store = new Map<string, R2Value>()

  async get(key: string): Promise<R2ObjectBody | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    const body = entry.body
    return {
      key,
      version: "1",
      size: new TextEncoder().encode(body).byteLength,
      etag: "test-etag",
      httpEtag: '"test-etag"',
      checksums: {} as R2Checksums,
      uploaded: entry.uploaded,
      customMetadata: entry.customMetadata,
      storageClass: "Standard",
      body: new Response(body).body!,
      bodyUsed: false,
      arrayBuffer: () => new Response(body).arrayBuffer(),
      bytes: async () => new TextEncoder().encode(body),
      text: async () => body,
      json: async <T>() => JSON.parse(body) as T,
      blob: () => new Response(body).blob(),
      writeHttpMetadata: () => {},
    } as unknown as R2ObjectBody
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | Blob | null,
    options?: R2PutOptions,
  ): Promise<R2Object> {
    const body =
      typeof value === "string"
        ? value
        : value === null
          ? ""
          : value instanceof Blob
            ? await value.text()
            : new TextDecoder().decode(
                value instanceof ArrayBuffer
                  ? new Uint8Array(value)
                  : new Uint8Array(
                      value.buffer,
                      value.byteOffset,
                      value.byteLength,
                    ),
              )
    const uploaded = new Date()
    this.store.set(key, {
      body,
      customMetadata: options?.customMetadata,
      uploaded,
    })
    return {
      key,
      version: "1",
      size: new TextEncoder().encode(body).byteLength,
      etag: "test-etag",
      httpEtag: '"test-etag"',
      checksums: {} as R2Checksums,
      uploaded,
      customMetadata: options?.customMetadata,
      storageClass: "Standard",
      writeHttpMetadata: () => {},
    } as R2Object
  }

  async delete(key: string | string[]): Promise<void> {
    for (const item of Array.isArray(key) ? key : [key]) this.store.delete(item)
  }

  async clear(): Promise<void> {
    this.store.clear()
  }
}

export const createTestEnv = () => ({
  CACHE_KV: new MemoryKV(),
  EASYEDA_COMPONENT_CACHE: new MemoryR2() as MemoryR2 & R2Bucket,
  USE_D1: "false",
  DB: {} as D1Database,
})

export const createFootprinterStringsD1 = (
  rows: Array<{
    copper_iou: number | null
    footprinter_string: string | null
    lcsc: number
    updated_at: string
  }>,
): D1Database =>
  ({
    prepare: () => ({
      bind: (lcsc: number) => ({
        all: async () => ({
          results: rows.filter((row) => row.lcsc === lcsc),
          meta: { changes: 0 },
        }),
      }),
    }),
  }) as unknown as D1Database

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
