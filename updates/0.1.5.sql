SET search_path TO "public";

-- Add Column for files
ALTER TABLE files  ADD COLUMN IF NOT EXISTS  url   TEXT;