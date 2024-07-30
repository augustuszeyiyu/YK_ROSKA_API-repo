SET search_path TO "public";

-- Add/rename Column
DO $$
    BEGIN
        ALTER TABLE roska_groups  RENAME COLUMN  installment_amount TO win_amount;
    EXCEPTION
        WHEN undefined_column THEN RAISE NOTICE 'column installment_amount does not exist';
     END;
$$;


ALTER TABLE roska_members ADD COLUMN IF NOT EXISTS details      JSONB    NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS "roska_members#details" ON roska_members USING gin (details);


CREATE OR REPLACE FUNCTION set_roska_groups_bid_end_time()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the time part to 23:59:59
    NEW.bid_end_time := DATE_TRUNC('day', NEW.bid_start_time) + INTERVAL '7 days - 1 second';
    NEW.installment_deadline := DATE_TRUNC('day', NEW.bid_end_time) + INTERVAL '7 days - 1 second';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;