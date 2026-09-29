# Extended promotional component filter

`/api/search?is_extended_promotional=true` and
`/components/list.json?is_extended_promotional=true` select promotional extended
parts. The components HTML table exposes the boolean column and checkbox.
Selecting both Basic and Extended Promotional includes either class; package,
subcategory, text, preferred and stock constraints still apply.

## Source and refresh

The full-catalog build requests JLCPCB's **Basic & Promotional Extended** catalog
(`componentLibraryType=base`, `preferredComponentFlag=true`), then records only
members whose returned `componentLibraryType` is `expand`. It does not assume
that every preferred component is promotional, or infer promotions from prose.

This is the catalog shown at <https://jlcpcb.com/parts/basic_parts>. On
2026-09-12, a live run returned 1,586 catalog members and 1,235 extended members:
C1034 was promotional, while C1002 was permanently basic. These are observations
at that time, not promises that a promotion remains active.

The fetcher validates complete pagination, unique codes and recognized library
types, and rejects failed, empty or incomplete responses. `hasNextPage` is not
trusted: the live API returned false on a nonfinal page. No account credentials
are required; the anonymous XSRF token is kept in memory.

`INCLUDE_COMPONENT_CATALOG=1 bun run setup:derived-sync-db` fetches the catalog
before rebuilding SQLite. Programmatic callers must supply the complete verified
`extendedPromotionalLcscNumbers` list. Missing or invalid input fails before an
existing output file is removed. Derived-only and stock-only builds do not fetch
the promotional catalog.

## Rollout

Run the existing **D1 migrations** workflow with `full_catalog` before deploying
the worker, so `component_catalog` and its rebuilt `search_index` contain
`is_extended_promotional`. Do not add a default-zero migration: older schemas
must fail visibly rather than report invented promotion data. The existing
full-catalog cache and refresh cadence also determine promotion freshness;
stock-only refreshes do not refresh promotions.

This change covers the current source-db-v2 catalog/search path. It does not add
promotion fields to each specialized derived-table route or restore the legacy
cache build path.

## Checks

```sh
bun test tests/extended-promotional-components.test.ts tests/build-derived-sync-db.test.ts tests/promotional-search.test.ts
```

Tests cover pagination and rejection, preservation of existing output on missing
input, SQLite catalog materialization, search-index rebuild, both boolean values,
basic/promotional union, preferred-only counterexample, out-of-stock exclusion,
LCSC/package/text filters, FTS and fallback search, and HTML filter/column output.
Tests use local fixtures and make no network calls.
