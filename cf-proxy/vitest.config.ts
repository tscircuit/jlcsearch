import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config"

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          kvNamespaces: ["CACHE_KV"],
          bindings: {
            ORIGIN_URL: "https://jlcsearch.fly.dev",
          },
        },
      },
    },
  },
})
