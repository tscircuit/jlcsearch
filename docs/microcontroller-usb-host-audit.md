# MCU USB host evidence audit

`lib/db/derivedtables/microcontroller-usb-host-audit.json` records the entire
9,763-row production MCU catalog captured on 2026-10-28 UTC, including parts with
no stock. There are 9,745 distinct manufacturer ordering codes. This is a pinned
catalog audit, not a claim about every future supplier listing.

The JSON `coverage` object contains the current counts of confirmed host,
confirmed no-host, and unknown listings. Each `parts` entry identifies its LCSC
number and exact manufacturer code. Confirmed decisions reference an entry in
`sources`, which records the manufacturer document, source URL, role evidence,
identity/package matching method, and a PDF SHA-256 when available. Unknown
entries contain the actual unresolved source or identity issue and an attempted
source URL when available. Unknown does **not** mean no host.

## Snapshot and reproducibility

The read-only export is attached to [workflow run 40634728938](https://github.com/tscircuit/jlcsearch/actions/runs/40634728938).
The ledger records its capture time, row counts, and original JSON SHA-256. The
workflow's full-catalog export includes all rows rather than only the most-stocked
parts, and the snapshot includes the original supplier attributes used to locate
documentation. The source cache recovery procedure is documented in
[source-cache-recovery.md](./source-cache-recovery.md).

Three GPT-6.1 Terra reviewers audited separate manufacturer groups, with additional
cross-checks and source recovery. An exact source match was required before
assigning a boolean. The recorded evidence is the review result; its wording is
not a keyword-generated classification. Some source URLs are supplier mirrors of
manufacturer-authored documents. Manufacturer product tables, hardware manuals,
and explicit product-brief capability statements supplement datasheets where
needed. Negative decisions require a complete device-specific hardware/interface
inventory or an explicit restricted USB role; omission from a brief’s marketing
feature list alone is insufficient. Broken links, incorrect supplier PDFs, generic
CPU manuals, incomplete briefs and ambiguous order codes were investigated and
remain unknown where a supported decision could not be established.

## Decision rules

- **Host:** the chip provides a native USB host controller, documented host mode,
  or explicitly host-capable programmable USB hardware. External USB PHYs,
  transceivers, VBUS switches, connectors and host software may still be required.
- **No host:** the complete native peripheral inventory excludes USB, or the
  documented USB implementation is device-only. A USB hub, power-delivery
  controller or serial bridge does not become a host because it connects to one.
- **Unknown:** manufacturer evidence does not establish the role for the exact
  catalog device. Missing metadata, USB programmer references and family marketing
  language are insufficient to decide.

Device-selection tables, package pin availability, ordering keys and documented
silicon revisions were checked. Packaging, temperature and reel suffixes can
share an explicitly identified silicon decision when those options do not change
the peripheral inventory. A host-capable family is not enough to classify a
package or derivative that lacks the controller or its pins.

Examples of distinctions preserved in the audit:

- PSoC CY8C6244LQI-S4D92 has USB host; CY8C6244AZI-S4D92 lacks USB. Newer
  manufacturer PSoC 6 documents explicitly add host-mode descriptions, correcting
  older device-only wording for applicable parts.
- SAM E70/S70/V71 package variants and PIC32MX device groups differ in USB
  availability; the audit retains their exact order codes.
- LPC3240/3250 integrate an OHCI host controller despite using an external
  transceiver. Type-C power-source roles and USB-connected debugging tools do not
  establish a native data host.

## Runtime and migration

The derived-table rebuild uses this exact-code ledger before supplier metadata.
Reviewed unknowns stay `NULL`, even if a supplier attribute claims host support.
Verified host support also sets `has_usb`, so combining the USB and USB Host
filters cannot hide a confirmed host because older supplier metadata omitted USB.

Migration `0018_microcontroller_interfaces.sql` adds `has_usb_host` and backfills
only the documented exact ordering codes. Unknowns remain `NULL`; unrelated
columns and stock are preserved. SQLite's ASCII-only `UPPER()` behavior is handled
for the catalog's Unicode manufacturer codes.

After changing the ledger, regenerate the migration:

```sh
bun scripts/generate-microcontroller-interface-migration.ts
bun test tests/lib/microcontroller-interfaces.test.ts tests/lib/microcontroller-usb.test.ts
```

The focused tests validate all catalog rows, evidence references, package/revision
regressions, and the real SQLite migration against the full audited catalog. They
also verify that combined interface filters intersect and that unknowns match
neither USB Host Yes nor No. Apply the migration before deploying the worker;
the existing deploy script applies migrations first.

To extend the audit, add or correct an exact catalog entry and its manufacturer
source, update the coverage counts, regenerate the migration, and run the checks.
Do not replace unknowns with false to improve apparent coverage. There may still
be USB hosts among unresolved listings; the ledger makes those gaps explicit.
