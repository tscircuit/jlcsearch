declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database
    EASYEDA_COMPONENT_CACHE: R2Bucket
    CACHE_KV: KVNamespace
  }

  export const env: ProvidedEnv
  export const SELF: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  }
}
