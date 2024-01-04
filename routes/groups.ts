import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { BaseError, LoginError, UserError } from '/lib/error';
import { GroupError } from "/lib/error/gruop-error";
import { SysVar } from "/data-type/sysvar";


export = async function(fastify: FastifyInstance) {
    /** 各會期結算列表 **/
    {
        const schema = {
			description: '各會期結算列表',
			summary: '各會期結算列表',
            params: {},
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/group/settlement-list', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            const {uid} = req.session.token!;

            const {rows} = await Postgres.query<{win_time:RoskaGroups['win_time']}>(`
                SELECT g.win_time
                FROM roska_groups g
                LEFT JOIN roska_members m ON g.sid = m.sid
                WHERE m.uid = $1
                GROUP BY g.win_time
                ORDER BY win_time DESC`, [uid]);


            return res.status(200).send(rows);
        });
    }
    /** 各會期結算 **/
    {
        const schema = {
			description: '各會期結算',
			summary: '各會期結算',
            params: {
                sid: {type: 'string'}
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaGroups['sid']}}>('/group/serial/settlement/:sid', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            const {uid} = req.session.token!;
            const {sid} = req.params;

            const {rows:SERIALS} = await Postgres.query<RoskaSerials>(`
                SELECT * 
                FROM roska_serials 
                WHERE sid=$1`, [sid]);

            const {rows:SYSVARS} = await Postgres.query<SysVar>(`
                SELECT * 
                FROM sysvar 
                WHERE key in ($1, $2)
                ORDER BY key ASC;`, ['handling_fee', 'transition_fee']);

            const handling_fee = Number(SYSVARS[0].value);
            const transition_fee = Number(SYSVARS[1].value);

            const {rows} = await Postgres.query<{win_time:RoskaGroups['win_time']}>(`
                SELECT g.gid, g.win_time
                FROM roska_groups g
                LEFT JOIN roska_members m ON g.sid = m.sid
                WHERE m.uid = $1
                GROUP BY g.gid, g.win_time
                ORDER BY win_time DESC`, [uid]);


            const {rows:GROUPS} = await Postgres.query<RoskaGroups>(`
                SELECT 
                FROM roska_members m
                CROSS JOIN LATERAL jsonb_to_recordset(m."details") "d" ("id" integer,
                                                                    "role" text)
                LEFT JOIN roska_members m ON g.sid=m.sid
                WHERE g.sid = $1 AND m.uid = $2 AND g.win_time IS NOT NULL
                ORDER BY g.gid ASC`, [sid, uid]);

            
            for (const elm of GROUPS) {
                
            }
            
            return res.status(200).send(GROUPS);
        });
    }
	/** 新成立會組列表 **/
    {
        const schema = {
			description: '新成立會組列表',
			summary: '新成立會組列表',
            params: {},
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/serial/new-list', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            
            const {rows} = await Postgres.query<RoskaSerials>(`
                SELECT * FROM roska_serials 
                WHERE bid_start_time >= NOW()
                ORDER BY sid ASC`);
            return res.status(200).send(rows);
        });
    }
    /** 已加入的會組 **/
    {
        const schema = {
			description: '已加入的會組',
			summary: '已加入的會組',
            params: {},
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/serial/on-list', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }
            
            const {uid} = req.session.token!;
            const {rows} = await Postgres.query<RoskaSerials>(`
                SELECT m.mid, m.create_time as join_time, s.* 
                FROM roska_members m
                INNER JOIN roska_serials s ON m.sid = s.sid
                WHERE m.uid=$1
                ORDER BY m.mid ASC, m.sid ASC;`, [uid]);

            return res.status(200).send(rows);
        });
    }

    /** 搜尋該會組會期 **/
    {
        const schema = {
			description: '搜尋該會組會期',
			summary: '搜尋該會組會期',
            params: {
                type: 'object',
                properties:{
                    sid: {type: 'string'}
                }
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaGroups['sid']}}>('/group/group/:sid', {schema}, async (req, res)=>{
            const {uid} = req.session.token!;
            if (uid === undefined) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            const {sid} = req.params;
            const {rows} = await Postgres.query(`SELECT * FROM roska_groups WHERE sid=$1 ORDER BY gid ASC`, [sid]);

            return res.status(200).send(rows);
        });
    }


    {
        const schema = {
			description: '加入會組',
			summary: '加入會組',
            params: {
                type: 'object',
				properties: {
                    sid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Params:{sid:RoskaSerials['sid']}}>('/group/member/:sid', {schema}, async (req, res)=>{
            const {uid}:{uid:User['uid']} = req.session.token!;

            const {sid} = req.params;


            const {rows: [roska_serial]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1;`, [sid]);
            if (roska_serial === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }


            const {rows: [member_count]} = await Postgres.query<{count:num_str}>(`
                SELECT COALESCE(COUNT(m.mid), 0) AS count
                FROM roska_members m
                LEFT JOIN roska_serials s ON m.sid = s.sid
                WHERE m.sid = $1;`, [sid]);
            
            
            const total_members = Number(member_count.count);
            if (roska_serial.member_count === total_members) {
                return res.errorHandler(GroupError.GROUP_SERIAL_IS_FULL);
            }

            const next = `${total_members}`.padStart(2, '0');
            const mid = `${sid}-${next}`;
            const details = JSON.stringify([{
                uid,
                gid: `${sid}-t00`,
                earn: 0,
                pay: roska_serial.basic_unit_amount,
                handling_fee: 0,
                transition_fee: 0,
            }]);
            const sql = PGDelegate.format(`INSERT INTO roska_members (mid, sid, uid, details) VALUES({mid}, {sid}, {uid}, {details});`, {mid, sid, uid, details});
    
            await Postgres.query(sql);

          
            
			res.status(200).send({});
		});
    }

    {
        const schema = {
			description: '搜尋該團下的成員',
			summary: '搜尋該團下的成員',
            params: {
                description: '搜尋該團下的成員',
                type: 'object',
				properties: {
                    sid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaSerials['sid']}}>('/group/member/:sid', {schema}, async (req, res)=>{
            const {uid}:{uid:User['uid']} = req.session.token!;
            const {sid} = req.params;

            const {rows} = await Postgres.query(
                `SELECT m.mid, m.sid, u.uid, u.name, m.gid
                FROM roska_members m 
                INNER JOIN users u ON m.uid=u.uid
                WHERE m.sid=$1
                ORDER BY m.mid ASC;`,[sid]);

            return res.status(200).send(rows);
        });
    } 

    {
        const schema = {
			description: '下標',
			summary: '下標',
            body: {
                type: 'object',
				properties: {
                    gid:        { type: 'string' },
                    bid_amount: { type: 'number' },
                },
                required: ['gid', 'bid_amount']
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{gid:RoskaMembers['gid'], bid_amount:RoskaMembers['bid_amount']}}>('/group/bid', {schema}, async (req, res)=>{
            
            const {uid}:{uid:User['uid']} = req.session.token!;

            const {gid, bid_amount} = req.body;

            
            const {rows:[roska_group]} = await Postgres.query<RoskaGroups>(`SELECT * FROM roska_groups WHERE gid=$1;`, [gid]);

            const {rows:[roska_serial]} = await Postgres.query<RoskaSerials>(`
                SELECT * 
                FROM roska_serials 
                WHERE sid=$1 
                AND max_bid_amount >= $2 
                AND min_bid_amount <= $2;`, 
                [roska_group.sid, bid_amount]);
              
            
            if (roska_serial === undefined) {
                return res.errorHandler(GroupError.INVALID_bid_amount);
            }

            const {rows:[roska_member]} = await Postgres.query<RoskaMembers>(`SELECT * FROM roska_members WHERE uid=$1 AND sid=$2;`, [uid, roska_group.sid]);


            const sql = PGDelegate.format(`
                INSERT INTO roska_bids(mid, gid, sid, uid, bid_amount) 
                VALUES ({mid}, {gid}, {sid}, {uid}, {bid_amount})
                RETURNING *;`, {
                    mid: roska_member.mid,
                    gid: roska_group.gid,
                    sid: roska_member.sid,
                    uid: roska_member.uid,
                    bid_amount
                });

            const {rows:[row]} = await Postgres.query(sql);

            return res.status(200).send(row);
        });   
    }

};
