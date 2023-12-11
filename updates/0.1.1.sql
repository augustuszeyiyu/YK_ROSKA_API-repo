SET search_path TO "public";


-- Create a trigger function to update win_time and installment_deadline
CREATE OR REPLACE FUNCTION update_win_time_and_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.win_time IS NULL THEN
        -- Set the time part to 23:59:59
        NEW.installment_deadline := DATE_TRUNC('day', NEW.win_time) + INTERVAL '4 days - 1 second';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;