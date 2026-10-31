# Minimum rated MCU clock

The site is https://jlcsearch.tscircuit.com. On `/microcontrollers/list` and
`/microcontrollers/list.json`, `cpu_speed_min_hz=72MHz` requires a listed maximum
CPU clock rating **greater than or equal to 72,000,000 Hz**. This is the catalog's
`CPU Maximum Speed`, not a measured or configured runtime clock. The table labels
it “Rated Max CPU Clock” and the filter “Min Rated CPU Clock”.

The existing `microcontroller.cpu_speed_hz` REAL column already stores this rating
in Hz. No new schema or live infrastructure changes are required. The importer
and query use the same parser: positive decimal Hz/kHz/MHz values, optional
whitespace before the unit, case insensitive. Query input also accepts bare
numbers as Hz. Catalog values require a unit. Missing, zero, negative, malformed,
ambiguous ranges/multiple ratings, nonfinite, and values above the maximum safe
integer become null on import. No description, oscillator, or part-number fallback
is used. Invalid nonempty query thresholds return no matches. Empty/absent input
removes the predicate and preserves existing results. With an active threshold,
null, nonnumeric, nonpositive, infinite, or out-of-range stored ratings are excluded.
The GET form retains the input and other MCU filters, the JSON link retains the
query, and “Clear filters” returns to the unfiltered MCU page. Other component
categories do not expose or apply this MCU parameter.

## Evidence and data refresh limitation

`docs/generated/single_chip_microcomputermicrocontroller.md` records the source
attribute `CPU Maximum Speed`, including RP2040 `133MHz`, STM32F103C8T6 `72MHz`,
and STM8S003F3P6TR `16MHz`, as well as missing/`-` values. A read-only public API
sample on 2026-10-31 (100 rows, default stock ordering) confirmed those integer MHz
formats and matching Hz storage, plus missing/`-` attributes. The bounded sample
is not an audit of every production rating. Hz/kHz/decimal cases are supported
parser regression cases; no claim is made that they occur in that sample.

The previous importer used an unanchored integer-MHz regex, which could misread
fractional or malformed values. Corrected extraction takes effect when maintainers
next rebuild/sync the `microcontroller` derived table using the existing workflow.
Previously misparsed production values cannot be repaired by this code change
alone. No production data was rewritten, no workflow was dispatched, and no
catalog values were invented. Existing stored valid integer MHz ratings can be
filtered immediately once the worker change is deployed by maintainers.
