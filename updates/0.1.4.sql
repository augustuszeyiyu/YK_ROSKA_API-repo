SET search_path TO "public";

-- Add Column for roska_members
ALTER TABLE roska_members  DROP COLUMN IF EXISTS  details;
DROP INDEX IF EXISTS "roska_members#details";


-- roska_details
DROP TABLE IF EXISTS roska_details CASCADE;
CREATE TABLE IF NOT EXISTS roska_details (
    sid                         VARCHAR(13)			NOT NULL,
    gid                         VARCHAR(17)		    NOT NULL,    
    mid 					    VARCHAR(20)		    NOT NULL,    
    uid                         VARCHAR(32)         NOT NULL,
    live                        BOOLEAN             NOT NULL DEFAULT true,
    bid_amount                  DECIMAL             NOT NULL DEFAULT 0,
    earn                        DECIMAL             NOT NULL DEFAULT 0,
    pay                         DECIMAL             NOT NULL DEFAULT 0,
    handling_fee                DECIMAL             NOT NULL DEFAULT 0,
    transition_fee              DECIMAL             NOT NULL DEFAULT 0,
	update_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    create_time					TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    PRIMARY KEY (gid, sid, mid, uid),
    FOREIGN KEY (sid) REFERENCES roska_serials(sid),
    FOREIGN KEY (mid) REFERENCES users(uid)
);