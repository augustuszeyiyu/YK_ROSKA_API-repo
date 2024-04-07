SET search_path TO "public";

-- Add Column for roska_members
ALTER TABLE roska_members  ADD COLUMN IF NOT EXISTS  transit_to   VARCHAR(32)         NOT NULL DEFAULT '';
ALTER TABLE roska_members  ADD COLUMN IF NOT EXISTS  transit_gid  VARCHAR(17)         NOT NULL DEFAULT '';