# Optical sensor coverage

The Optical Sensors page combines the prepared source-db-v2 derived table with the live JLCPCB catalog. Archive preparation filters on `present` and recent `last_on_stock`; a listed part can consequently be missing from the archive-derived table even though it still exists in the supplier catalog.

A concrete regression is **PMW3360DM-T2QU / C20612443**, used by [Mustafa's wireless mouse](https://tscircuit.com/MustafaMulla29/wireless-mouse-pcb). The [live JLCPCB listing](https://jlcpcb.com/partdetail/Pixart-PMW3360DMT2QU/C20612443) files it under Specialized Sensors. On 1 October 2026, JLCPCB's API returned this part with stock 0, while the deployed Optical Motion list omitted it. The live catalog also listed PAW3395DM-T6QU / C41346211 and PMW3610DM-SUDU / C42442560 with stock 0.

`refresh-optical-sensors.ts` reads every page of the optical categories in the [JLCPCB taxonomy](https://jlcpcb.com/parts/all-electronic-components), plus mixed categories that contain navigation, proximity, dust, infrared temperature, PIR, position, and encoder products. Shared classification uses category, description, semantic sensor-type attributes, and known part families. It covers:

- Mouse/trackball navigation and optical-flow sensors, including PMW/PAW/PAN, supported ADNS parts, PAT9125/PAT9130 and PAA5100.
- Ambient light, color, infrared and UV sensing, optical proximity and distance/ranging.
- Photodiodes, phototransistors, photoresistors and optical interrupters.
- Image sensors, photoelectric and fiber/laser sensors, infrared remote receivers.
- Infrared temperature/thermal and PIR sensors, optical encoders, optical gesture and integrated optical biometric sensors.

Emitters, transceivers, lens accessories and unrelated capacitive/inductive products do not qualify merely because they share a mixed category. Known integrated optical examples include [MAX30102](https://www.analog.com/en/products/max30102.html); semantic detection does not rely on the short list of model overrides alone.

The refresh validates total counts, pagination, category membership, duplicate IDs and stock values before merging any data. Live records overwrite stock and price, including stock 0; archive-only optical types are retained. Empty or incomplete responses cannot replace the data. The live import verifies that PMW3360 is present before writing, and creates the query indexes even when a stock-only prepared database has no derived table.

All derived builds requesting `optical_sensor`, full catalog builds, and nightly stock syncs perform this refresh. The workflow uploads the refreshed optical table without rebuilding it from the incomplete archive. `verify-optical-sensors.ts` checks each sensor type separately, since the public list is capped at 100 records, and explicitly checks PMW3360's stock and boolean availability in JSON and its presence in HTML. It refreshes both direct filter URLs and URLs emitted by the old and current forms.

Out-of-stock parts remain visible in the category and Optical Motion filter with `stock: 0` and `in_stock: false`. The In Stock filter allows users to request available parts separately; catalogue inclusion does not imply assembly stock. The category still depends on the supplier's published catalog and metadata, rather than asserting that unlisted parts are available.
