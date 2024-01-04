SET search_path TO "public";

-- Add Column
ALTER TABLE roska_groups  RENAME COLUMN IF EXISTS installment_amount TO win_amount;

ALTER TABLE roska_members ADD COLUMN IF NOT EXISTS details      JSONB    NOT NULL DEFAULT '{}'::jsonb;


CREATE OR REPLACE FUNCTION set_roska_groups_bid_end_time()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the time part to 23:59:59
    NEW.bid_end_time := DATE_TRUNC('day', NEW.bid_start_time) + INTERVAL '4 days - 1 second';
    NEW.installment_deadline := DATE_TRUNC('day', NEW.bid_end_time) + INTERVAL '6 days - 1 second';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;