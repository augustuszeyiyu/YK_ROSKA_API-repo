SET search_path TO "public";



-- users
DROP TABLE IF EXISTS "users" CASCADE;
CREATE TABLE IF NOT EXISTS "users" ( 
    uid						        VARCHAR(32)         NOT NULL PRIMARY KEY, 
    nid                             VARCHAR(12)         NOT NULL, 
    name						    VARCHAR(60)			NOT NULL DEFAULT '',
	gender					        VARCHAR(1)			NOT NULL,
	birth_date 				        DATE 				NOT NULL,
    address                         VARCHAR(100)        NOT NULL DEFAULT '',
    line_id                         VARCHAR(50)         NOT NULL DEFAULT '',
    contact_home_number			    VARCHAR(12)			NOT NULL DEFAULT '',
    contact_mobile_number			VARCHAR(12)			NOT NULL,
    role						    SMALLINT			NOT NULL DEFAULT 0,
    bank_code					    VARCHAR(3)			NOT NULL,
    branch_code					    VARCHAR(50)			NOT NULL,
    bank_account_name			    VARCHAR(60)			NOT NULL,
    bank_account_number			    VARCHAR(20)			NOT NULL,

	emergency_nid				    VARCHAR(32)         NOT NULL,
    emergency_contact			    VARCHAR(12)         NOT NULL,
    emergency_contact_number	    VARCHAR(12)         NOT NULL,
    emergency_contact_relation      VARCHAR(60)         NOT NULL,

	relative_path				    LTREE				DEFAULT NULL,
    referrer_uid					VARCHAR(32)         NOT NULL DEFAULT '',
	referrer_path				    LTREE				DEFAULT NULL,
    volunteer_uid				    VARCHAR(32)         NOT NULL DEFAULT '',
    volunteer_path				    LTREE				DEFAULT NULL,
    revoked                         BOOLEAN             NOT NULL DEFAULT false,
    password                        TEXT                NOT NULL,
	update_time					    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    create_time					    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


CREATE UNIQUE INDEX IF NOT EXISTS "users#nid" on "users"("nid");
CREATE INDEX IF NOT EXISTS "users#name" on "users" USING brin("name");
CREATE INDEX IF NOT EXISTS "users#contact_home_number" on "users"("contact_home_number");
CREATE UNIQUE INDEX IF NOT EXISTS "users#contact_mobile_number" on "users"("contact_mobile_number");

CREATE INDEX IF NOT EXISTS "users#referrer_id" ON "users" USING brin("referrer_uid");
CREATE INDEX IF NOT EXISTS "users#volunteer_id" ON "users" USING brin("volunteer_uid");

CREATE INDEX IF NOT EXISTS "users#relative_path" ON "users" USING gist("relative_path");
CREATE INDEX IF NOT EXISTS "users#referrer_path" ON "users" USING gist("referrer_path");

CREATE TRIGGER trigger_users_update_time
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_update_time();

CREATE OR REPLACE FUNCTION update_referrer_path() 
RETURNS trigger AS $$
BEGIN

    NEW.nid = UPPER(NEW.nid);
    NEW.password = encode(digest(NEW.password, 'sha1'), 'hex');
    NEW.password = crypt(NEW.password, gen_salt('bf',8));

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

CREATE TRIGGER update_user_referrer_path BEFORE INSERT
   ON users FOR EACH ROW
   EXECUTE PROCEDURE update_referrer_path();



CREATE OR REPLACE FUNCTION change_password() 
RETURNS trigger AS $$
BEGIN
    IF OLD.password IS DISTINCT FROM NEW.password THEN
        NEW.password = encode(digest(NEW.password, 'sha1'), 'hex');
        NEW.password = crypt(NEW.password, gen_salt('bf',8));
        NEW.update_time = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' VOLATILE;

CREATE TRIGGER update_user_password BEFORE UPDATE
    ON users FOR EACH ROW 
    EXECUTE PROCEDURE change_password();


DROP FUNCTION IF EXISTS verify_password(text, text);
CREATE OR REPLACE FUNCTION verify_password(user_nid text, user_pass text)
RETURNS TABLE (uid varchar(32), role SMALLINT) AS $$
BEGIN
    user_pass = encode(digest(user_pass, 'sha1'), 'hex');
    RETURN QUERY SELECT u.uid, u.role FROM users u
    WHERE u.nid = user_nid AND u.password = crypt(user_pass, u.password);
END;
$$ LANGUAGE 'plpgsql';



-- captchas 
DROP TABLE IF EXISTS captchas CASCADE;
CREATE TABLE IF NOT EXISTS captchas (
	cid 			            VARCHAR(32)         NOT NULL PRIMARY KEY,
    captcha_text				VARCHAR(6)			NOT NULL,
	expired_time                INTEGER             NOT NULL DEFAULT extract(epoch from NOW() + interval '5 minutes'),
	create_time                 TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);



-- login_sessions
DROP TABLE IF EXISTS login_sessions CASCADE;
CREATE TABLE IF NOT EXISTS login_sessions (
	id 			                VARCHAR(32)         NOT NULL PRIMARY KEY,
    uid                         VARCHAR(32)         NOT NULL,
    role						SMALLINT			NOT NULL DEFAULT 0,
	login_time                  INTEGER             NOT NULL DEFAULT extract(epoch from NOW()),
	expired_time                INTEGER             NOT NULL DEFAULT extract(epoch from NOW() + interval '30 days'),
    revoked 		            BOOLEAN             NOT NULL DEFAULT false,
    revoked_time                TIMESTAMPTZ,
	create_time                 TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
	FOREIGN KEY (uid) REFERENCES users(uid)
);
CREATE TRIGGER change_login_sessions_login_time BEFORE UPDATE
    ON public.login_sessions FOR EACH ROW 
    EXECUTE PROCEDURE change_login_time();





-- roska_serials
DROP TABLE IF EXISTS roska_serials CASCADE;
CREATE TABLE IF NOT EXISTS roska_serials (
    sid                         VARCHAR(13)		    NOT NULL PRIMARY KEY,
    uid                         VARCHAR(32)         NOT NULL,
    member_count                SMALLINT            NOT NULL DEFAULT 25,
    cycles                      SMALLINT            NOT NULL DEFAULT 24,
    basic_unit_amount           DECIMAL             NOT NULL DEFAULT 0,
    min_bid_amount              DECIMAL             NOT NULL DEFAULT 0,
    max_bid_amount              DECIMAL             NOT NULL DEFAULT 0,
    bid_unit_spacing            INTEGER             NOT NULL DEFAULT 0,
    frequency                   VARCHAR(15)         NOT NULL DEFAULT 'monthly',
    bit_start_time              TIMESTAMPTZ         NOT NULL,
    bit_end_time                TIMESTAMPTZ         NOT NULL,
	update_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    create_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    FOREIGN KEY (uid) REFERENCES users(uid)
);


CREATE TRIGGER trigger_roska_serials_update_time
BEFORE UPDATE ON roska_serials
FOR EACH ROW
EXECUTE FUNCTION update_update_time();

-- Create a BEFORE INSERT trigger to set the default value for bit_end_time
CREATE OR REPLACE FUNCTION set_roska_serials_bit_end_time()
RETURNS TRIGGER AS $$
DECLARE
    duration INT;
BEGIN
    IF NEW.frequency = 'monthly' THEN
        duration := NEW.member_count; -- Use the member_count as the duration
        NEW.bit_end_time := DATE_TRUNC('day', NEW.bit_start_time) + (duration || ' months'::TEXT)::INTERVAL - INTERVAL '1 second';
    ELSIF NEW.frequency = 'biweekly' THEN
        duration := NEW.member_count * 2; -- Biweekly, so multiply by 2
        NEW.bit_end_time := DATE_TRUNC('day', NEW.bit_start_time) + (duration || ' weeks'::TEXT)::INTERVAL - INTERVAL '1 second';
    END IF;  
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the roska_serials table
CREATE TRIGGER set_roska_serials_bit_end_time_trigger
BEFORE INSERT OR UPDATE ON roska_serials
FOR EACH ROW
EXECUTE FUNCTION set_roska_serials_bit_end_time();







-- roska_groups
DROP TABLE IF EXISTS roska_groups CASCADE;
CREATE TABLE IF NOT EXISTS roska_groups (
	gid 					    VARCHAR(3)		    NOT NULL PRIMARY KEY,
    sid                         VARCHAR(13)		    NOT NULL,
    bit_start_time              TIMESTAMPTZ         NOT NULL,
    bit_end_time                TIMESTAMPTZ         NOT NULL,
	update_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    create_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    FOREIGN KEY (sid) REFERENCES roska_serials(sid)
);
CREATE INDEX IF NOT EXISTS "roska_groups#sid" on roska_groups(sid);

CREATE TRIGGER trigger_roska_gruops_update_time
BEFORE UPDATE ON roska_groups
FOR EACH ROW
EXECUTE FUNCTION update_update_time();

-- Create a BEFORE INSERT trigger to set the default value for bit_end_time
CREATE OR REPLACE FUNCTION set_roska_groups_bit_end_time()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the time part to 23:59:59
    NEW.bit_end_time := DATE_TRUNC('day', NEW.bit_start_time) + INTERVAL '4 days - 1 second';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the roska_groups table
CREATE TRIGGER set_roska_groups_bit_end_time_trigger
BEFORE INSERT OR UPDATE ON roska_groups
FOR EACH ROW
EXECUTE FUNCTION set_roska_groups_bit_end_time();




-- roska_members
DROP TABLE IF EXISTS roska_members CASCADE;
CREATE TABLE IF NOT EXISTS roska_members (
    mid 					    VARCHAR(16)		    NOT NULL PRIMARY KEY,
    gid 					    VARCHAR(3)		    NOT NULL,
    sid                         VARCHAR(13)			NOT NULL,
    uid                         VARCHAR(32)         NOT NULL DEFAULT '',
    bid_amount                  DECIMAL             NOT NULL DEFAULT 0,
    win                         BOOLEAN,
    win_amount                  DECIMAL             NOT NULL DEFAULT 0,
    win_time                    TIMESTAMPTZ,
    transition                  SMALLINT            NOT NULL DEFAULT 0,
    installment_amount          DECIMAL             NOT NULL DEFAULT 0,
    installment_deadline        TIMESTAMPTZ,
    joing_time                  TIMESTAMPTZ,
    assignment_path             LTREE               NOT NULL DEFAULT '',
	update_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    create_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    FOREIGN KEY (sid) REFERENCES roska_serials(sid),
    FOREIGN KEY (gid) REFERENCES roska_groups(gid),
    FOREIGN KEY (uid) REFERENCES users(uid)
);
--不轉讓 有得標 (transition=0)
-- (死會數  * basic_unit_amount) + (活會數 ＊ (basic_unit_amount-bid_amount)) 

--有轉讓 有得標 (transition=1)
-- (死會數  * basic_unit_amount) - ((會期數 ＊ handling_fee) - transition_fee + Interest_bonus) 

CREATE TRIGGER trigger_roska_members_update_time
BEFORE UPDATE ON roska_members
FOR EACH ROW
EXECUTE FUNCTION update_update_time();

-- Create a trigger function to update win_time and installment_deadline
CREATE OR REPLACE FUNCTION update_win_time_and_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.win = false THEN
        -- Set the time part to 23:59:59
        NEW.installment_deadline := DATE_TRUNC('day', NEW.win_time) + INTERVAL '4 days - 1 second';
    ELSEIF NEW.win = true THEN
      NEW.win_time := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the roska_members table
CREATE TRIGGER trigger_roska_members_update_win_time
BEFORE UPDATE ON roska_members
FOR EACH ROW
EXECUTE FUNCTION update_win_time_and_deadline();





-- history_receipts
DROP TABLE IF EXISTS history_receipts CASCADE;
CREATE TABLE IF NOT EXISTS history_receipts (
    receipt_id                  VARCHAR(32)         NOT NULL PRIMARY KEY,
    recipient_name              VARCHAR(100)        NOT NULL,
    amount                      DECIMAL(10, 0)      NOT NULL,
    payment_date                TIMESTAMPTZ         NOT NULL,
    payment_method              VARCHAR(50)         NOT NULL,
    reference_number            VARCHAR(100)        NOT NULL,
    notes                       TEXT                NOT NULL DEFAULT '',
    create_time                 TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);


-- history_remittances
DROP TABLE IF EXISTS history_remittances CASCADE;
CREATE TABLE IF NOT EXISTS history_remittances (
    remittance_id               VARCHAR(32)         NOT NULL PRIMARY KEY,
    sender_name                 VARCHAR(100)        NOT NULL,
    recipient_name              VARCHAR(100)        NOT NULL,
    amount                      DECIMAL(10, 0)      NOT NULL,
    currency                    VARCHAR(3)          NOT NULL,
    remittance_date             TIMESTAMPTZ         NOT NULL,
    sender_account              VARCHAR(50)         NOT NULL,
    recipient_account           VARCHAR(50)         NOT NULL,
    reference_number            VARCHAR(100)        NOT NULL,
    notes                       TEXT                NOT NULL DEFAULT '',
    create_time                 TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- files
DROP TABLE IF EXISTS files CASCADE;
CREATE TABLE IF NOT EXISTS files (
    fid                         VARCHAR(32)         NOT NULL PRIMARY KEY,
    uid                         VARCHAR(32)         NOT NULL,
    file_path                   VARCHAR(255)        NOT NULL,
    file_name                   VARCHAR(100)        NOT NULL,
    encoding                    VARCHAR(100)        NOT NULL,
    mimetype                    VARCHAR(100)        NOT NULL,
    create_time                 TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    FOREIGN KEY (uid) REFERENCES users(uid)
);


-- payments
DROP TABLE IF EXISTS payments CASCADE;
CREATE TABLE IF NOT EXISTS payments (
	id							VARCHAR(32)			NOT NULL PRIMARY KEY,
    uid							VARCHAR(12)         NOT NULL, 
    bank_code					VARCHAR(3)			NOT NULL,
    branch_code					VARCHAR(50)			NOT NULL,
    bank_account_name			VARCHAR(60)			NOT NULL,
    bank_account_number			VARCHAR(20)			NOT NULL,
    amount                      DECIMAL             NOT NULL,
    file_link                   VARCHAR(200)        NOT NULL,
	update_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    create_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS "payments#uid" on payments(uid);



-- banks
DROP TABLE IF EXISTS banks CASCADE;
CREATE TABLE IF NOT EXISTS banks (
	bank_code 					VARCHAR(3)			NOT NULL,
    branch_code             	VARCHAR(7)          NOT NULL DEFAULT '',
	bank_name					VARCHAR(60)			NOT NULL,
	branch_path					LTREE				NOT NULL,
	update_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    create_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
	PRIMARY KEY (bank_code, branch_code)
);