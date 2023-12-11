SET search_path TO "public";


-- start users
ALTER TABLE users ALTER COLUMN password SET default '';

CREATE OR REPLACE FUNCTION update_referrer_path() 
RETURNS trigger AS $$
BEGIN

    NEW.nid = UPPER(NEW.nid);

    IF NEW.line_id IS NOT NULL THEN
        NEW.line_id = LOWER(NEW.line_id);
    END IF;

 	IF NEW.contact_mobile_number ~ '^(09\d{2}-\d{3}-\d{3})$' THEN
        -- Format for mobile phone numbers (e.g., 0905-095-111)
        NEW.contact_mobile_number = regexp_replace(NEW.contact_mobile_number, '(\d{4})-(\d{3})-(\d{3})', '\1\2\3');
    ELSIF NEW.contact_home_number ~ '^(0[2-9]\d{1}-\d{4}-\d{3})$' THEN
        -- Format for home phone numbers (e.g., 02-2823-3708 or 03-6688-231)
        NEW.contact_home_number = regexp_replace(NEW.contact_home_number, '(\d{2})-(\d{4})-(\d{3})', '\1\2\3');
	END IF;

    IF NEW.create_time IS NULL THEN
        NEW.create_time = NOW();
    END IF;

    IF NEW.referrer_uid = '' OR NEW.referrer_uid IS NULL THEN
		NEW.referrer_path = 'root'::ltree||NEW.uid::ltree;
	ELSE
		SELECT referrer_path||NEW.uid::ltree INTO NEW.referrer_path from users WHERE uid = NEW.referrer_uid;  
	END IF;

    IF NEW.volunteer_uid IS NOT NULL THEN
		SELECT volunteer_path||NEW.uid::ltree INTO NEW.volunteer_path from users WHERE uid = NEW.volunteer_uid;  
	END IF;


    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' VOLATILE;

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

-- end users

-- start roska_groups
CREATE OR REPLACE FUNCTION set_roska_groups_bid_end_time()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the time part to 23:59:59
    NEW.bid_end_time := DATE_TRUNC('day', NEW.bid_start_time) + INTERVAL '4 days - 1 second';
    NEW.installment_deadline := DATE_TRUNC('day', NEW.bid_end_time) + INTERVAL '7 days - 1 second';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- end roska_groups