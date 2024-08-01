import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaBids, RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { BaseError, LoginError, UserError } from '/lib/error';
import { GroupError } from "/lib/error/gruop-error";
import { SysVar } from "/data-type/sysvar";
import { cal_win_amount } from "/lib/cal-win-amount";


export = async function(fastify: FastifyInstance) {
    /** 加入會組 **/
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
            const member_sql = PGDelegate.format(`INSERT INTO roska_members (mid, sid, uid) VALUES({mid}, {sid}, {uid});`, {mid, sid, uid});
            const detail_sql = PGDelegate.format(`INSERT INTO roska_details (mid, sid, uid) VALUES({mid}, {sid}, {uid}, {profit});`, {mid, sid, uid, profit:-roska_serial.basic_unit_amount});
            const sql_list = [member_sql, detail_sql]
            await Postgres.query(sql_list.join('\n'));
          
            
			res.status(200).send({});
		});
    }
    /** 搜尋該團下的成員 **/
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

            const {rows} = await Postgres.query(`
                SELECT m.mid, m.sid, u.uid, u.name, m.gid, m.win_amount
                FROM roska_members m 
                INNER JOIN users u ON m.uid=u.uid
                WHERE m.sid=$1
                ORDER BY m.mid ASC;`,[sid]);

            return res.status(200).send(rows);
        });
    }
    /** 下標 **/
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

        fastify.post<{Body:{gid:RoskaBids['gid'], bid_amount:RoskaBids['bid_amount']}}>('/group/bid', {schema}, async (req, res)=>{
            
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
    /** 加入會組 **/
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
           
            const sql = PGDelegate.format(`INSERT INTO roska_members (mid, sid, uid) VALUES({mid}, {sid}, {uid});`, {mid, sid, uid});
    
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
    /** 會員轉讓 **/
    // {
    //     const schema = {
	// 		description: '會員轉讓 mid',
	// 		summary: '會員轉讓 mid',
    //         params: {
    //             type: 'object',
    //             properties:{
    //                 mid: {type: 'string'}
    //             },
    //             required:["mid"],
    //         },
    //         security: [{ bearerAuth: [] }],
	// 	};

    //     fastify.post<{Params:{mid:RoskaMembers['mid']}}>('/group/member/transition/:mid', {schema}, async (req, res)=>{
    //         const {uid}:{uid:User['uid']} = req.session.token!;
    //         const {mid} = req.params;


    //         // NOTE: query handling_fee, transition_fee, interest_bonus
    //         const {rows:sysvar} = await Postgres.query<SysVar>(`SELECT * FROM sysvar WHERE key in ('handling_fee', 'interest_bonus', 'transition_fee') ORDER BY key ASC;`);            
            // const handling_fee = Number(sysvar[0].value);
            // const interest_bonus = Number(sysvar[1].value);
            // const transition_fee = Number(sysvar[2].value);


            
    //         const {rows:[members_info]} = await Postgres.query<RoskaMembers&RoskaSerials&{header:string}>(`
    //             SELECT *, s.uid as header
    //             FROM roska_members m
    //             INNER JOIN roska_serials s ON m.sid = s.sid
    //             WHERE m.mid = $1;
    //         `, [mid]);


    //         if (members_info.gid === '') {
    //             await Postgres.query<RoskaMembers>(`
    //                 UPDATE roska_members 
    //                 SET transition = 1, transit_to = $2
    //                 WHERE mid=$1;`, [mid, members_info.header]);
    //         }
    //         else {
    //             const update_promise:string[] = [];
    //             const {T, A, transition} = cal_win_amount(handling_fee, interest_bonus, transition_fee, members_info.cycles, members_info.basic_unit_amount, 1000, members_info.gid, 1); 
    //             const win_amount = A;

    //             const sql_1 = PGDelegate.format(`
    //                 UPDATE roska_members 
    //                 SET transition = {transition}, win_amount = {win_amount}, transit_to = {transit_to}
    //                 WHERE sid={sid} AND mid = {mid};`, {sid: members_info.sid, mid, win_amount, transition, transit_to: members_info.header});
    //             update_promise.push(sql_1);

    //             const sql_2 = PGDelegate.format(`UPDATE roska_groups SET win_amount = {win_amount} WHERE sid = {sid} AND gid = {gid};`, {gid: members_info.gid, win_amount});
    //             update_promise.push(sql_2);

    //             await Postgres.query(update_promise.join('\n '));  
    //         }

            
    //         return res.status(200).send({});
    //     });
    // }
};
