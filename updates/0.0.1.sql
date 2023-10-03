SET search_path TO "public";
SET client_encoding = EUC_TW;
SET timezone = 'Asia/Taipei';
SET auto_explain.log_nested_statements = ON;


CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS btree_gin;



CREATE OR REPLACE FUNCTION change_update_time()
RETURNS TRIGGER AS $$
BEGIN
   NEW.update_time = extract(epoch from now()); 
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE OR REPLACE FUNCTION change_login_time()
RETURNS TRIGGER AS $$
BEGIN
   NEW.login_time = extract(epoch from now()); 
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';



-- sysvar
CREATE TABLE IF NOT EXISTS sysvar (
   id                          BIGSERIAL           NOT NULL PRIMARY KEY,
   key                         TEXT                NOT NULL,
   value                       JSON                NOT NULL default 'null'::json
);
CREATE UNIQUE INDEX IF NOT EXISTS "sysvar#key" ON "sysvar" ("key");

INSERT INTO sysvar(key, value) VALUES('version', '0') ON CONFLICT (key) DO NOTHING;
INSERT INTO sysvar(key, value) VALUES('max_members', '25') ON CONFLICT (key) DO NOTHING;
INSERT INTO sysvar(key, value) VALUES('handling_fee', '250') ON CONFLICT (key) DO NOTHING;
INSERT INTO sysvar(key, value) VALUES('holiday', '{"solar_calendar_holiday":[0101,228,261,321,1010],"lunar_calendar_holiday":[1231,65,66,67,68,69,325,815]}') ON CONFLICT (key) DO NOTHING;
