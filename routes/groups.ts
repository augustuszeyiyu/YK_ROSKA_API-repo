import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { BaseError, LoginError, UserError } from '/lib/error';
import { GroupError } from "/lib/error/gruop-error";


export = async function(fastify: FastifyInstance) {
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
                SELECT s.*
                FROM roska_members m
                INNER JOIN roska_serials s ON m.sid = s.sid
                WHERE m.uid=$1 GROUP BY m.sid, s.sid;`, [uid]);

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
			description: '新增會員入會',
			summary: '新增會員入會',
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


            const {rows:roska_groups} = await Postgres.query<RoskaGroups>(`SELECT * FROM roska_groups WHERE sid=$1;`, [sid]);
            if (roska_groups === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }


            const {rows:all_member_info} = await Postgres.query(`SELECT count(mid) FROM roska_members WHERE sid=$1 AND gid=$2 GROUP BY mid;`, [sid, roska_groups[0].gid]);

            const {rows:member_info} = await Postgres.query(`SELECT mid FROM roska_members WHERE sid=$1 AND uid=$2 ORDER BY mid ASC;`, [sid, uid]);
            if (member_info.length === roska_groups.length)  return res.status(200).send({});

            
            const next = `${all_member_info.length+1}`.padStart(2, '0');
            const mid = `${sid}-${next}`;
            const member_list:string[] = [];
            for (const {gid, sid} of roska_groups) {
                const data = PGDelegate.format(`INSERT INTO roska_members (sid, gid, mid, uid) VALUES({sid}, {gid}, {mid}, {uid});`, {sid, gid, mid, uid});
                member_list.push(data);
            }

            
            console.log(member_list);
            await Postgres.query(member_list.join('\n'));

          
            
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
                    gid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{gid:RoskaGroups['gid']}}>('/group:/gid', {schema}, async (req, res)=>{
            const {uid}:{uid:User['uid']} = req.session.token!;
            const {gid} = req.params;

            const {rows} = await Postgres.query(
                `SELECT m.mid, m.gid, u.uid, u.contact_mobile_number, u.address
                FROM roska_groups g
                INNER JOIN roska_members m ON g.gid=m=gid
                LEFT JOIN users u ON m.uid=u.uid
                WHERE g.gid=$1
                ORDER BY m.mid ASC;`,[gid]);

            return res.status(200).send(rows);
        });
    } 

    {
        const schema = {
			description: '下注',
			summary: '下注',
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


            const {rowCount} = await Postgres.query(`
                UPDATE roska_members m
                SET bid_amount = $1
                FROM roska_groups g
                WHERE m.gid = g.gid
                AND m.sid = g.sid
                AND m.uid = $2
                AND m.gid = $3
                AND g.bid_start_time >= NOW() 
                AND g.bid_end_time <= NOW() 
                RETURNING *;`,[bid_amount, uid, gid]);

            if (rowCount === 0) {
                return res.errorHandler(GroupError.INVALID_bid_start_time, [roska_group.bid_start_time, roska_group.bid_end_time]);
            }

            return res.status(200).send({});
        });   
    }

};
