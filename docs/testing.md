# Local and deployed tests

`bun test` runs branch tests without contacting the deployed catalog. PR CI
also runs the search, exact-inventory and processor rendering tests in the
Cloudflare runtime, using local fixtures and seeded D1 data.

The route contracts in `cf-proxy/test/contracts.test.ts` test a running
deployment. They are opt-in because production availability, inventory and
deployed code do not establish whether a PR is correct. Run them explicitly:

```sh
CF_TEST_BASE_URL=https://jlcsearch.tscircuit.com bun test cf-proxy/test/contracts.test.ts
```

Use a local or staging URL to check a different deployment. The **Deployed
route contracts** GitHub Actions workflow provides the same check manually.
Failures still fail that workflow; they are not suppressed or retried into
success. Without an explicit URL, the remote suite is skipped.
