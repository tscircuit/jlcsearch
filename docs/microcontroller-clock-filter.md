# CPU clocks on MCU and Linux-capable processor records

Both `/microcontrollers/list` and `/linux_capable_processors/list` show a
“Rated Max CPU Clock” cell on every component record. The cell displays the
catalog's `CPU Maximum Speed`, including **every value in a multi-clock list**
such as `750MHz;1.4GHz` or `400MHz, 800MHz, 1GHz`. This is a catalog rating,
not a measured or configured runtime clock. The original attributes also remain
available in the record and JSON response. No clock is inferred from the part
number, CPU family, oscillator, or description.

Single ratings are displayed with Hz/kHz/MHz/GHz units without rounding away
precision (for example, `32.768kHz`, `72MHz`, `1.2GHz`). Multiple or descriptive
catalog values are displayed verbatim and HTML-escaped. If no catalog value is
available, a valid stored numeric rating is displayed; otherwise the cell says
“Unknown”. The column is present even when the first record lacks a clock.

## Minimum clock filter

Both categories and their `.json` routes accept `cpu_speed_min_hz`. For example,
`cpu_speed_min_hz=1.2GHz` requires a single listed maximum CPU rating **greater
than or equal to 1,200,000,000 Hz**. The form calls this “Min Rated CPU Clock”.
It combines with all existing filters, retains input in the GET form and JSON
link, and has a “Clear filters” link back to that category's unfiltered page.
Unrelated component categories ignore this parameter.

The shared importer/query parser accepts positive decimal Hz/kHz/MHz/GHz values,
optional whitespace before the unit, and case-insensitive units. Query input
also accepts bare numbers as Hz; catalog values require a unit. Missing, zero,
negative, malformed, ranges, multiple ratings, nonfinite, and values above the
maximum safe integer become null on import. Multiple catalog ratings remain
visible, but are excluded by an active numeric minimum filter: the catalog does
not identify which core each value belongs to. Invalid nonempty query thresholds
return no matches. Empty/absent input preserves unfiltered results. An active
threshold excludes null, nonnumeric, nonpositive, infinite, or unsafe stored
ratings. JSON continues to expose `cpu_speed_hz` as Hz (or null), plus the original
catalog attribute; display formatting does not change numeric API values.

## Schema and data refresh

MCUs already have `microcontroller.cpu_speed_hz`. Migration
`0021_linux_processor_clock.sql` adds nullable REAL
`linux_capable_processor.cpu_speed_hz`, preserving existing rows. Fresh derived
table creation includes this field; both database type definitions are updated.
Deployments must apply the migration before syncing the new Linux column. The
existing deployment script already applies migrations before worker deployment.

The migration deliberately leaves legacy Linux rows null rather than duplicating
the strict TypeScript parser in SQLite. Maintainers must rebuild/sync both derived
tables through the existing workflow to populate Linux numeric clocks and repair
MCU ratings previously misread by the old integer-MHz parser. Local existing
tables must be recreated using the setup script's `--reset <table>` option before
population. Until refresh, raw catalog clocks are still visible on records;
Linux rows with null numeric clocks are excluded by an active minimum filter.
No production migration, data sync, deployment, or workflow dispatch was performed
as part of this PR update, and no build settings were changed.

## Catalog evidence

`docs/generated/single_chip_microcomputermicrocontroller.md` records integer MHz
MCU ratings, including RP2040 `133MHz`, STM32F103C8T6 `72MHz`, STM8S003F3P6TR
`16MHz`, and missing/`-` values. A bounded read-only public MCU API sample on
2026-10-31 confirmed those forms.

A 100-row public Linux processor API sample on 2026-11-05 included RK3562J
`1.2GHz`, RK3576 `2.2GHz`, ATSAMA5D31A-CU `536MHz`, MIMX8MN5DVPIZAA
`750MHz;1.4GHz`, AM6412BSCGHAALV `400MHz, 800MHz, 1GHz`, and missing ratings.
These are catalog values, not independently verified silicon specifications.
The bounded samples do not audit every production record.
