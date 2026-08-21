import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          kvNamespaces: ["CACHE_KV"],
          r2Buckets: ["EASYEDA_COMPONENT_CACHE"],
        },
      },
    },
  },
});
