SET search_path TO "public";

-- Add Column for roska_members
ALTER TABLE roska_members  ADD COLUMN IF NOT EXISTS  transit_to   VARCHAR(32)         NOT NULL DEFAULT '';
ALTER TABLE roska_members  ADD COLUMN IF NOT EXISTS  transit_gid  VARCHAR(17)         NOT NULL DEFAULT '';


CREATE OR REPLACE FUNCTION update_referrer_path()
RETURNS trigger AS $$
BEGIN

    NEW.nid = UPPER(NEW.nid);

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