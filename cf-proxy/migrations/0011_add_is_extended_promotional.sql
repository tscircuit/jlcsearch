-- Add is_extended_promotional column to components table
ALTER TABLE components
ADD COLUMN is_extended_promotional BOOLEAN NOT NULL DEFAULT FALSE;
