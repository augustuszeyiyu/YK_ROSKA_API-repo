SET search_path TO "public";

-- Add Column
ALTER TABLE roska_groups  RENAME COLUMN IF EXISTS installment_amount TO win_amount;

ALTER TABLE roska_members ADD COLUMN IF NOT EXISTS details      JSONB    NOT NULL DEFAULT '{}'::jsonb;
