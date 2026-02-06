-- FTS5 setup for D1 (if needed)
-- Note: D1 may have limited FTS5 support. This script is optional.

-- Create FTS5 virtual table for component search
-- This mirrors the main app's components_fts table but only for derived tables

-- For now, skip FTS5 as it may not be needed for the D1 JSON API
-- The main search functionality is on the Fly.io server

-- If FTS5 is needed in the future, uncomment and adapt:
/*
DROP TABLE IF EXISTS components_fts;

CREATE VIRTUAL TABLE components_fts USING fts5(
  lcsc,
  mfr,
  mfr_chars,
  description,
  content='',
  tokenize='unicode61'
);

-- Populate from resistor table as example
INSERT INTO components_fts(lcsc, mfr, mfr_chars, description)
SELECT
  CAST(lcsc AS TEXT),
  mfr,
  REPLACE(mfr, '-', ' '),
  description
FROM resistor WHERE lcsc IS NOT NULL;

-- Add more tables as needed...
*/

SELECT 'FTS5 setup skipped - not required for D1 JSON API' AS status;
