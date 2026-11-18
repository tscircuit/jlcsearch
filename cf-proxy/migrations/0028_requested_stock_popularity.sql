-- Rank exact lookups by recent activity. Reuse the Worker's existing
-- once-per-part-per-hour requested_at update to count demand.
ALTER TABLE _jlcsearch_requested_parts ADD COLUMN demand_score INTEGER NOT NULL DEFAULT 1;

CREATE INDEX idx_requested_parts_recent ON _jlcsearch_requested_parts(requested_at);

CREATE TRIGGER count_requested_part_demand
AFTER UPDATE OF requested_at ON _jlcsearch_requested_parts
WHEN NEW.requested_at >= OLD.requested_at + 3600
BEGIN
  UPDATE _jlcsearch_requested_parts
  SET demand_score = (OLD.demand_score >> MIN(31, NEW.requested_at / 86400 - OLD.requested_at / 86400)) + 1
  WHERE lcsc = NEW.lcsc;
END;
