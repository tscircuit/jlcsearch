declare module "cloudflare:test" {
  interface ProvidedEnv {
    CACHE_KV: KVNamespace
    ORIGIN_URL: string
  }

  export const env: ProvidedEnv
  export const SELF: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  }
}
