# Compact JLCPCB search catalog

Run `bun standalone-jlcsearch/build.ts [output.json.gz]` on a connected build machine.
The default selection captures 20 common LCSC identities, including RP2040,
resistors, capacitors, timers and amplifiers. Custom `queries` can select other
parts or families (up to 10 results per query). It deduplicates by LCSC ID and keeps only search
fields. It does not claim complete inventory or manufacture missing results.

The gzip payload is a UTF-8 JSON object:

- `schema_version`: `1`
- `source`: `jlcpcb`
- `coverage`: `subset`
- `generated_at`: ISO timestamp of capture
- `components`: search records with `lcsc`, `mfr`, `package`, `description`, `stock`,
  `price`, and optional basic/preferred/category/subcategory fields

Install it at `jlcsearch/search-catalog.json.gz` in the standalone baked asset
directory. The fake service searches the decompressed records locally;
queries need not match the captured query strings. Stock and prices are snapshots; null means unknown.
Missing parts return an empty result in a limited catalog, never a live fallback.

This catalog contains search metadata only. EasyEDA models, footprints, datasheets
and registry package contents must be bundled separately for offline imports.
`encodeCatalog` can also take selected records from a local database export.

Run the fake HTTP service directly with `bun standalone-jlcsearch/server.ts`
(default loopback port 3080; override with `PORT`). Point any normal API client
at the printed `TSCIRCUIT_JLCSEARCH_BASE_URL`. It implements GET/HEAD and form
POST `/api/search` with JLC IDs, keywords, limits and package/basic/preferred
filters. The CLI only uses the base URL and the normal API response contract.

## Manual jscdn publishing

After the workflow is merged into the default branch, open Actions →
**Publish jlcsearch-standalone to jscdn** → **Run workflow**. Supply a new version
such as `0.1.0`. Catalog refresh is enabled by default; disable it to publish the
checked-in capture. There are no push, pull-request, release or scheduled publish
triggers, and no automatic version bumps.

The workflow builds a dependency-free Bun package named
`@tscircuit/jlcsearch-standalone`, packs and runs it from the actual tarball,
and publishes that tarball to GitHub Packages using `GITHUB_TOKEN` with
`packages: write`. jscdn proxies that registry; there is no direct CDN upload.
The workflow verifies the versioned CDN tarball against the local archive:

```text
https://jscdn.tscircuit.com/@tscircuit/jlcsearch-standalone/0.1.0.tgz
```

The jscdn Worker's existing `GITHUB_PACKAGES_TOKEN` must have read access to this
package. If CDN verification fails after publication, the registry version has
already been published; check access and CDN availability rather than trying to
publish that same version again. The exact tarball is retained as an Actions
artifact. Consumers run the package with Bun or import its exported request
handler; the compressed catalog ships beside the built server.

Local package-only check (uses the checked-in capture unless
`REFRESH_CATALOG=true`):

```sh
bun standalone-jlcsearch/package.ts 0.1.0
bun standalone-jlcsearch/smoke-package.ts standalone-jlcsearch/dist
```
