# Search API input rules

These rules apply to `/api/search` (`q`) and `/components/list` (`search`),
including their `.json` variants.

## Compatibility changes

Text search now needs at least one term that the existing trigram index can
use. Some previously accepted searches return HTTP 400 with
`error_code: "invalid_search"` instead of running an expensive scan:

| Previously accepted input | What to send instead |
| --- | --- |
| `DC` | `dc connector` |
| `IC` | `IC amplifier` |
| `8MHz` | `8MHz crystal` |

`DC` and `IC` are shorter than the index's three-character minimum. `8MHz` also
matches the existing `8M` alternative; that alternative is too short to use the
index by itself. Adding `crystal` lets the index narrow the candidates while
preserving both frequency spellings. Exact LCSC lookups, such as `C1`, still
work. Empty search text still permits browsing.

Search text must be at most 256 characters after trimming surrounding whitespace,
and must not contain a NUL character (`U+0000`, encoded as `%00` in a URL).

For `/api/search`, `limit` must be an integer from 1 through 1,000. The default is
100. Invalid values, including `-1`, `0` and `1001`, return 400; `-1` no longer
means unlimited results. `/components/list` keeps its fixed limit of 100 and
does not use a client-supplied `limit` parameter.

If a parameter is repeated, the **last value wins**, consistently for validation,
cache lookup, exact-part routing and execution. For example,
`?q=resistor&limit=100&limit=1001` returns 400, while
`?q=resistor&limit=1001&limit=100` uses 100. The same rule applies to `q`, `search`,
filters, and the `json` and `cachebust` controls on these routes.

Invalid requests are rejected before database access and return `Cache-Control:
no-store`. API/JSON callers receive an error object containing `error`,
`error_code` and `message`; HTML callers receive the same guidance as a page.

## Performance scope

The `MATCH` query avoids extra text reads and pattern checks against the FTS
table; the existing catalog checks and stock ordering remain. Broad searches can
still read and sort many matching parts before applying the result limit.
Local synthetic benchmarks are evidence of reduced work for those examples,
not a prediction of production latency or a guarantee against D1 overload.
