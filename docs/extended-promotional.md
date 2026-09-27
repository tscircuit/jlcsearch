# Promotional Extended status

`is_extended_promotional` exposes the JLCPCB Promotional Extended filter flag.
It is an alias of upstream `preferred`, rather than a new independent
classification. Existing `is_preferred` fields remain available.

## Source mapping

On 2026-09-07, the public [JLCPCB parts page](https://jlcpcb.com/parts/basic_parts/)
mapped its Promotional Extended filter to `preferredComponentFlag=true`.
The [frontend bundle](https://jlcpcb.com/ssr/js/ea8cc7970a45ec6cf08b.js)
had SHA-256 `b5545413622b4fd9c174b41d472b1b2625d47560fe65a619f8fc40fffe9a0687`.
This is the filter's meaning; other page rules can affect a displayed badge.

[jlcparts](https://github.com/yaqwsx/jlcparts/blob/master/jlcparts/lcsc.py)
fetches that preferred list, and its
[source database](https://github.com/yaqwsx/jlcparts/blob/master/jlcparts/sourceDb.py)
stores membership in `jlc_components.preferred`. Its generated attribute
format calls these parts `Preferred`. Matching part numbers and manufacturer
part numbers in the official page payload and the public
[jlcparts snapshot](https://yaqwsx.github.io/jlcparts/data/manifest.json)
gave the following examples:

| LCSC | Manufacturer part number | Official preferred flag | Snapshot attribute |
| --- | --- | --- | --- |
| C1034 | SDFL1608Q4R7KTF | true | Preferred |
| C1042 | SDFL2012Q1R0KTF | true | Preferred |
| C1043 | CMI201209U2R2KT | true | Preferred |
| C1002 | GZ1608D601TF | false | Basic |
| C1015 | GZ2012D101TF | false | Basic |
| C1035 | SDFL1608S100KTF | false | Basic |

These are dated observations, not permanent classifications. The mapping
does not add a `!basic` condition or search free-form attributes for a
promotional string.

## API and UI

The alias is available in `/components/list.json`, `/api/search`, the 50 configured
derived-category list routes, and the LCD/TFT display-driver list routes.
HTML pages show one **Promotional Extended** filter and table column.
The four separate analog-switch, ARM-processor, RISC-V-processor, and microphone
handlers that did not expose preferred status are outside this change.

```text
/components/list.json?is_extended_promotional=true
/resistors/list.json?is_extended_promotional=false
```

For the new parameter, `true`/`1` selects promotional parts, `false`/`0`
selects non-promotional parts, and empty, `All`, or invalid values add no
promotional filter. If both names occur, the explicitly supplied new name
takes precedence, including an empty or invalid value. An old `is_preferred`
parameter on its own keeps its previous route-specific interpretation.

The alias follows the existing response's null handling. Components, search,
and LCD/TFT routes normalize unknown preferred values to `false`, so their
new false filter includes SQL NULL. Generic derived categories preserve
unknown status as `null`; their false filter selects only zero. New upstream
snapshots provide non-null 0/1 flags.

## Storage and refresh

The legacy physical `components` table gains an indexed generated column
based on `preferred`, including for an empty table. The source-db-v2 builder
exposes the same alias in its temporary compatibility view. D1 keeps the
existing `preferred` and `is_preferred` columns, so no duplicate stored flag
or D1 schema migration is needed.

The compact stock snapshot contains `lcsc`, `stock`, and `preferred`. Within
the existing one-year stock-history window, absent parts receive zero stock
and a zero promotional flag. `stock_only` updates catalog and search rows when
either value changes, then copies the same batch's catalog flags to the known derived tables
that actually exist in the deployed schema and contain `lcsc` and
`is_preferred`. A derived row with no catalog match, or outside the current
source snapshot, is left unchanged. Every statement is restricted to at most
1,000 source identifiers, including derived updates, to avoid an unbounded
whole-table write. The updates are idempotent. Commands, including all their
statements, are packed to at most 100 KB to stay within shell argument limits
while retaining Wrangler's query endpoint for the nightly refresh.
See [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

A new response-cache namespace skips old KV bodies without the new API field
or HTML filter. Existing stock cache invalidation also refreshes promotional
results. Previously cached browser responses still follow their existing
revalidation lifetime. This does not rebuild derived membership or synchronize other
component attributes.

Deploy the worker before the next stock/full-catalog sync: the workflow's
source, remote-D1, and cached/uncached API checks now include promotional
status. Remote execution and production-scale performance must be verified
by the repository's deployment workflow.
