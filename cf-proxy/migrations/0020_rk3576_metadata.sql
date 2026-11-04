-- Metadata verified against https://jlcpcb.com/partdetail/Rockchip-RK3576/C42388007
-- Keep stock and prices unchanged; the requested-parts worker revalidates them.
UPDATE component_catalog SET
  category = 'Embedded Processors & Controllers',
  subcategory = 'Microcontrollers (MCU/MPU/SOC)',
  extra = json_set(CASE WHEN json_valid(extra) THEN extra ELSE '{}' END,
    '$.manufacturer', json_object('name', 'Rockchip'),
    '$.title', 'Rockchip RK3576')
WHERE lcsc = 42388007 AND mfr = 'RK3576';

UPDATE search_index SET
  category = 'Embedded Processors & Controllers',
  subcategory = 'Microcontrollers (MCU/MPU/SOC)',
  manufacturer_name = 'Rockchip',
  title = 'Rockchip RK3576',
  search_text = lower('Rockchip RK3576 Embedded Processors & Controllers Microcontrollers (MCU/MPU/SOC) '
    || coalesce(package, '') || ' ' || coalesce(description, '') || ' ' || coalesce(attributes, ''))
WHERE lcsc = 42388007 AND mfr = 'RK3576';

-- The old FTS index uses insertion-order rowids and can disagree with a
-- replaced catalog. Use the existing LIKE fallback until the stable-ID rebuild.
CREATE TABLE IF NOT EXISTS search_index_fts_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO search_index_fts_meta(key, value) VALUES ('ready', '0')
ON CONFLICT(key) DO UPDATE SET value = '0';
INSERT INTO search_index_fts_meta(key, value) VALUES ('ready_lcsc', '0')
ON CONFLICT(key) DO UPDATE SET value = '0';

INSERT INTO _jlcsearch_requested_parts(lcsc, requested_at, attempted_at)
VALUES (42388007, unixepoch(), 0)
ON CONFLICT(lcsc) DO UPDATE SET requested_at = excluded.requested_at, attempted_at = 0;
