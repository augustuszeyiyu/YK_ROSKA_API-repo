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
    role						    VARCHAR(20)			NOT NULL DEFAULT 'user',
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
    revoked                         BOOLEAN             NOT NULL DEFAULT false,
    password                        TEXT                NOT NULL,
	update_time					    INTEGER            	NOT NULL DEFAULT 0,
    create_time					    INTEGER				NOT NULL DEFAULT extract(epoch from now())
);


CREATE UNIQUE INDEX IF NOT EXISTS "users#nid" on "users"("nid");
CREATE INDEX IF NOT EXISTS "users#name" on "users" USING brin("name");
CREATE INDEX IF NOT EXISTS "users#contact_home_number" on "users"("contact_home_number");
CREATE UNIQUE INDEX IF NOT EXISTS "users#contact_mobile_number" on "users"("contact_mobile_number");

CREATE INDEX IF NOT EXISTS "users#referrer_id" ON "users" USING brin("referrer_uid");
CREATE INDEX IF NOT EXISTS "users#volunteer_id" ON "users" USING brin("volunteer_uid");

CREATE INDEX IF NOT EXISTS "users#relative_path" ON "users" USING gist("relative_path");
CREATE INDEX IF NOT EXISTS "users#referrer_path" ON "users" USING gist("referrer_path");



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

    IF NEW.create_time = 0 THEN
        NEW.create_time = extract(epoch from now());
    END IF;

    IF NEW.referrer_uid = '' OR NEW.referrer_uid IS NULL THEN
		NEW.referrer_path = 'root'::ltree||NEW.uid::ltree;
	ELSE
		SELECT referrer_path||NEW.uid::ltree INTO NEW.referrer_path from users WHERE uid = NEW.referrer_uid;  
	END IF;

    IF role = 'volunteer' THEN
        NEW.volunteer_path = 'root'::ltree||NEW.uid::ltree;
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
        NEW.update_time = extract(epoch from now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql' VOLATILE;

CREATE TRIGGER update_user_password BEFORE UPDATE
    ON users FOR EACH ROW 
    EXECUTE PROCEDURE change_password();


DROP FUNCTION IF EXISTS verify_password(text, text);
CREATE OR REPLACE FUNCTION verify_password(user_nid text, user_pass text)
RETURNS TABLE (uid varchar(32), role varchar(20)) AS $$
BEGIN
    user_pass = encode(digest(user_pass, 'sha1'), 'hex');
    RETURN QUERY SELECT uid, role FROM users
    WHERE nid = user_nid AND password = crypt(user_pass, password);
END;
$$ LANGUAGE 'plpgsql';


 

-- login_sessions
DROP TABLE IF EXISTS login_sessions CASCADE;
CREATE TABLE IF NOT EXISTS login_sessions (
	id 			                VARCHAR(32)         NOT NULL PRIMARY KEY,
    uid                         VARCHAR(32)         NOT NULL,
    role						VARCHAR(20)			NOT NULL,
	revoked 		            BOOLEAN             DEFAULT false,
	login_time                  INTEGER             DEFAULT extract(epoch from now()),
	expired_time                INTEGER             DEFAULT extract(epoch from now() + interval '720 hours'),
	create_time                 INTEGER             DEFAULT extract(epoch from now()),
	CONSTRAINT      "login_sessions#uid"        FOREIGN KEY (uid) REFERENCES users(uid)
);
CREATE TRIGGER change_login_sessions_login_time BEFORE UPDATE
    ON public.login_sessions FOR EACH ROW 
    EXECUTE PROCEDURE change_login_time();



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
	update_time					INTEGER             NOT NULL DEFAULT 0,
    create_time					INTEGER				NOT NULL DEFAULT extract(epoch from now()),
    FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS "payments#uid" on payments(uid);



-- banks
CREATE TABLE IF NOT EXISTS banks (
	bank_code 					VARCHAR(3)			NOT NULL,
    branch_code             	VARCHAR(7)          NOT NULL DEFAULT '',
	bank_name					VARCHAR(60)			NOT NULL,
	branch_path					LTREE				NOT NULL,
	update_time					INTEGER             NOT NULL DEFAULT 0,
    create_time					INTEGER				NOT NULL DEFAULT extract(epoch from now()),
	PRIMARY KEY (bank_code, branch_code)
);


-- roska_groups
DROP TABLE IF EXISTS roska_groups CASCADE;
CREATE TABLE IF NOT EXISTS roska_groups (
	gid 					    VARCHAR(15)		    NOT NULL PRIMARY KEY,
    uid                         VARCHAR(32)         NOT NULL,
    max_member             	    INTEGER             NOT NULL DEFAULT 0,
    revoked                     BOOLEAN             NOT NULL DEFAULT false,
	update_time					INTEGER             NOT NULL DEFAULT 0,
    create_time					INTEGER				NOT NULL DEFAULT extract(epoch from now())
);


-- roska_members
DROP TABLE IF EXISTS roska_members CASCADE;
CREATE TABLE IF NOT EXISTS roska_members (
    mid 					    VARCHAR(15)		    NOT NULL PRIMARY KEY,
    gid 					    VARCHAR(15)		    NOT NULL,
    uid                         VARCHAR(32)         NOT NULL DEFAULT '',
    total_sessions              SMALLINT            NOT NULL DEFAULT 0,
    joing_time                  INTEGER             NOT NULL DEFAULT 0,
	update_time					INTEGER             NOT NULL DEFAULT 0,
    create_time					INTEGER				NOT NULL DEFAULT extract(epoch from now()),
    FOREIGN KEY (gid) REFERENCES roska_groups(gid),
    FOREIGN KEY (uid) REFERENCES users(uid)
);

CREATE INDEX IF NOT EXISTS "roska_members#gid" on roska_members(gid);


-- roska_details
DROP TABLE IF EXISTS roska_details CASCADE;
CREATE TABLE IF NOT EXISTS roska_details (
    mid 					    VARCHAR(15)		    NOT NULL,
    gid 					    VARCHAR(15)		    NOT NULL,
    uid                         VARCHAR(32)         NOT NULL DEFAULT '',
    session                     SMALLINT            NOT NULL DEFAULT 0,
    bid                         DECIMAL             NOT NULL DEFAULT 0,
    win                         BOOLEAN             NOT NULL DEFAULT false,
    win_time                    INTEGER             NOT NULL DEFAULT 0,
    installment_deadline        INTEGER             NOT NULL DEFAULT 0,
    installment_amount          DECIMAL             NOT NULL DEFAULT 0,
	update_time					INTEGER             NOT NULL DEFAULT 0,
    create_time					INTEGER				NOT NULL DEFAULT extract(epoch from now()),
    PRIMARY KEY (mid, gid, uid, session),
    FOREIGN KEY (gid) REFERENCES roska_groups(gid),
    FOREIGN KEY (mid) REFERENCES roska_members(mid),
    FOREIGN KEY (uid) REFERENCES users(uid)
);