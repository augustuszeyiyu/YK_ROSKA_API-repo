SET search_path TO "public";

-- Add Column
ALTER TABLE roska_serials ADD COLUMN IF NOT EXISTS mids         TEXT[]   NOT NULL DEFAULT '{}';

ALTER TABLE roska_groups  ADD COLUMN IF NOT EXISTS win_amount   DECIMAL  NOT NULL DEFAULT 0;

ALTER TABLE roska_members ADD COLUMN IF NOT EXISTS details      JSONB    NOT NULL DEFAULT '{}'::jsonb;
