CREATE TABLE IF NOT EXISTS footprinter_strings (
  lcsc INTEGER PRIMARY KEY,
  footprinter_string TEXT,
  copper_iou REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (copper_iou IS NULL OR (copper_iou >= 0 AND copper_iou <= 1)),
  CHECK (
    footprinter_string IS NULL
    OR (copper_iou IS NOT NULL AND copper_iou > 0.95)
  )
);

CREATE INDEX IF NOT EXISTS idx_footprinter_strings_copper_iou
  ON footprinter_strings (copper_iou);
