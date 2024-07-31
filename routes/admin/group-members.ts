import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { GroupError } from "/lib/error/gruop-error";
import { BaseError, UserError } from "/lib/error";
import { SysVar } from "/data-type/sysvar";
import { cal_win_amount } from "/lib/cal-win-amount";


type PaginateCursorUser = PaginateCursor<RoskaSerials[]>;

export = async function(fastify: FastifyInstance) {
    /* 用 sid 搜尋該團下的成員 */
    {
        const schema = {
			description: '用 sid 搜尋該團下的成員',
			summary: '用 sid 搜尋該團下的成員',
            params: {
                description: '用 sid 搜尋該團下的成員',
                type: 'object',
				properties: {
                    sid: { type: 'string' },
                    gid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaSerials['sid'], gid:RoskaGroups['gid']}}>('/group/member/:sid/:gid', {schema}, async (req, res)=>{
            const {sid, gid} = req.params;

            if (sid !== undefined && gid === undefined) {
                const {rows} = await Postgres.query(`
                    SELECT u.name, m.*
                    FROM roska_members m 
                    INNER JOIN users u ON m.uid=u.uid
                    WHERE m.sid=$1
                    ORDER BY m.mid ASC;`,[sid]);
    
                return res.status(200).send(rows);
            }
            else {
                const {rows} = await Postgres.query(`
                    SELECT u.name, m.*, b.bid_amount
                    FROM roska_groups g
                    LEFT JOIN roska_members m ON g.sid=m.sid
                    LEFT JOIN roska_bids b ON m.mid = b.mid
                    INNER JOIN users u ON m.uid=u.uid
                    WHERE g.gid = $1
                    ORDER BY m.mid ASC;`,[gid]);

                return res.status(200).send(rows);
            }
        });
    }
    /* 新增會員入會 */
    {
        const schema = {
			description: '新增會員入會',
			summary: '新增會員入會',
            body: {
                type: 'object',
				properties: {
                    sid:                    { type: 'string' },
                    contact_mobile_number:  { type: 'string' }                    
                },
                required: ['sid', 'contact_mobile_number']
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{sid:RoskaSerials['sid'], contact_mobile_number:User['contact_mobile_number']}}>('/group/member', {schema}, async (req, res)=>{
            const {sid, contact_mobile_number} = req.body;

            const {rows: [roska_serial]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1;`, [sid]);
            if (roska_serial === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }


            
            const {rows:[USER]} = await Postgres.query<User>(`SELECT * FROM users WHERE contact_mobile_number=$1;`, [contact_mobile_number]);
            if (USER === undefined) {
                return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS);
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
           
            const sql = PGDelegate.format(`INSERT INTO roska_members (mid, sid, uid) VALUES({mid}, {sid}, {uid});`, {mid, sid, uid:USER.uid});
    
            await Postgres.query(sql);

          
            
			res.status(200).send({});
		});
    }
    /* 新增多位會員入會 */
    {
        const schema = {
			description: '新增多位會員入會',
			summary: '新增多位會員入會',
            body: {
                type: 'object',
				properties: {
                    sid: { type: 'string' },
                    contact_mobile_numbers: { 
                        type: 'array', 
                        items: {type:'string'} 
                    },
                },
                required: ['sid', 'contact_mobile_numbers']
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{ sid:RoskaSerials['sid'], contact_mobile_numbers:User['contact_mobile_number'][]}}>('/group/members', {schema}, async (req, res)=>{
            const {sid, contact_mobile_numbers} = req.body;


            if (contact_mobile_numbers === undefined || contact_mobile_numbers.length === 0) {
                return res.errorHandler(UserError.MOBILE_PHONE_IS_REQUIRED);
            }


            const {rows: [roska_serial]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1;`, [sid]);
            if (roska_serial === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }


            
            const {rows:USERS} = await Postgres.query<User>(`SELECT * FROM users WHERE contact_mobile_number = ANY($1);`, [contact_mobile_numbers]);
            if (USERS.length === 0) {
                return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS);
            }
            

            const {rows: [member_count]} = await Postgres.query<{count:num_str}>(`
                SELECT COALESCE(COUNT(m.mid), 0) AS count
                FROM roska_members m
                LEFT JOIN roska_serials s ON m.sid = s.sid
                WHERE m.sid = $1;`, [sid]);
            
            
            let total_members = Number(member_count.count);
            
            
            if (roska_serial.member_count === total_members) {
                return res.errorHandler(GroupError.GROUP_SERIAL_IS_FULL);
            }

            let last_index_member = total_members-1;
            let remain_space = roska_serial.member_count - total_members;
            let insert_sql:string[] = [];


            for (const phone_number of contact_mobile_numbers) {
                for (let index = 0; index < USERS.length; index++) {
                    const USER = USERS[index];

                    if (USER.contact_mobile_number === phone_number && remain_space > 0) {
                        --remain_space;
                        const next = `${++last_index_member}`.padStart(2, '0');
                        const mid = `${sid}-${next}`;
                        
                        const sql = PGDelegate.format(`INSERT INTO roska_members (mid, sid, uid) VALUES({mid}, {sid}, {uid});`, {mid, sid, uid:USER.uid});
                        insert_sql.push(sql);
                    }
                }                
            }        
            
    
            await Postgres.query(insert_sql.join('\n '));
          
            
			res.status(200).send({});
		});
    }
    /** 會組序號 sid下的會員列表 **/
    {
        const schema = {
			description: '搜搜尋會組序號 sid',
			summary: '搜尋會組序號 sid',
            params: {
                type: 'object',
                properties:{
                    sid: {type: 'string'}
                },
                required:["sid"],
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaMembers['sid']}}>('/group/member/all-list/:sid', {schema}, async (req, res)=>{

            const {sid} = req.params;
            const {rows} = await Postgres.query<RoskaMembers>(`
                SELECT m.*, u.name||RIGHT(mid, 3) as name
                FROM roska_members m
                INNER JOIN users u ON m.uid = u.uid
                WHERE sid=$1 
                ORDER BY mid ASC;`, [sid]);

            return res.status(200).send(rows);
        });
    }
    /** 刪除會員 **/
    {
        const schema = {
			description: '刪除會組序號 mid',
			summary: '刪除會組序號 mid',
            params: {
                type: 'object',
                properties:{
                    mid: {type: 'string'}
                },
                required:["mid"],
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.delete<{Params:{mid:RoskaMembers['mid']}}>('/group/member/:mid', {schema}, async (req, res)=>{
            const {mid} = req.params;
            
            await Postgres.query<RoskaSerials>(`DELETE FROM roska_bids    WHERE mid=$1;`, [mid]);
            await Postgres.query<RoskaSerials>(`DELETE FROM roska_members WHERE mid=$1;`, [mid]);
            

            return res.status(200).send({});
        });
    }
    /** admin 幫會員下標 **/
    {
        const schema = {
			description: 'admin 幫會員下標',
			summary: 'admin 幫會員下標',
            body: {
                type: 'object',
                properties:{
                    mids: {
                        type: 'array', 
                        items: { type: 'string' }
                    },
                    gid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{mids:RoskaMembers['mid'][], gid:RoskaMembers['gid']}}>('/group/member/bid', {schema}, async (req, res)=>{
            const {mids, gid} = req.body;
            

            const update_promise:string[] = [];
            const {rows:members_info} = await Postgres.query<RoskaMembers&RoskaSerials&{header:string}>(`
                SELECT *, s.uid as header 
                FROM roska_members m
                INNER JOIN roska_serials s ON m.sid = s.sid
                WHERE m.mid = ANY($1);
            `, [mids]);
            

            for (const {mid, sid, uid} of members_info) {                
                const sql_1 = PGDelegate.format(`
                    INSERT INTO roska_bids (mid, gid, sid, uid, bid_amount)
                    VALUE ({mid}, {gid}, {sid}, {uid}, {bid_amount})
                    ON CONFICT (mid, gid, sid, uid) DO NOTHING;`, 
                    {mid, gid, sid, uid, bid_amount:1000});
                update_promise.push(sql_1);
            }
            await Postgres.query(update_promise.join('\n '));  
            
            return res.status(200).send({});
        });
    }
    /** admin 搜尋有下標的會員 **/
    {
        const schema = {
			description: 'admin 搜尋有下標的會員',
			summary: 'admin 搜尋有下標的會員',
            params: {
                type: 'object',
                properties:{
                    gid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Params:{gid:RoskaMembers['gid']}}>('/group/member/bid/:gid', {schema}, async (req, res)=>{
            const {gid} = req.params;
            
            const {rows:members_info} = await Postgres.query<RoskaMembers&RoskaSerials&{header:string}>(`
                SELECT * 
                FROM roska_bids b
                INNER JOIN users u ON b.uid = u.uid
                WHERE b.gid = $1;
            `, [gid]);
            
            return res.status(200).send(members_info);
        });
    }
    /** admin 會員轉讓 **/
    {
        const schema = {
			description: 'admin 多名會員轉讓',
			summary: 'admin 多名會員轉讓',
            body: {
                type: 'object',
                properties:{
                    mids: {
                        type: 'array', 
                        items: { type: 'string' }
                    },
                    transition: { type: 'number' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{mids:RoskaMembers['mid'][], transition:RoskaMembers['transition']}}>('/group/member/transition', {schema}, async (req, res)=>{
            const {mids, transition} = req.body;
            
            if ([0, 1].includes(transition) === false) {
                return res.errorHandler(BaseError.BAD_REQUEST, {transition})
            }


            // NOTE: query handling_fee, transition_fee, interest_bonus
            const {rows:sysvar} = await Postgres.query<SysVar>(`SELECT * FROM sysvar WHERE key in ('handling_fee', 'interest_bonus', 'transition_fee') ORDER BY key ASC;`);            
            const handling_fee = Number(sysvar[0].value);
            const interest_bonus = Number(sysvar[1].value);
            const transition_fee = Number(sysvar[2].value);
            

            const update_promise:string[] = [];
            const {rows:members_info} = await Postgres.query<RoskaMembers&RoskaSerials&{header:string}>(`
                SELECT *, s.uid as header 
                FROM roska_members m
                INNER JOIN roska_serials s ON m.sid = s.sid
                WHERE m.mid = ANY($1);
            `, [mids]);
            

            for (const {mid, gid, sid, cycles, basic_unit_amount, header} of members_info) {
                const win_amount = cal_win_amount(handling_fee, interest_bonus, transition_fee, cycles, Number(basic_unit_amount), 1000, gid, transition); 
                
                const sql_1 = PGDelegate.format(`
                    UPDATE roska_members 
                    SET transition = {transition}, win_amount = {win_amount}, transit_to = {transit_to}
                    WHERE sid={sid} AND mid = {mid};`, {sid, mid, win_amount, transition, transit_to: header});
                update_promise.push(sql_1);

                const sql_2 = PGDelegate.format(`UPDATE roska_groups SET win_amount = {win_amount} WHERE sid = {sid} AND gid = {gid};`, {sid, gid, win_amount});
                update_promise.push(sql_2);
            }
            await Postgres.query(update_promise.join('\n '));  
            
            return res.status(200).send({});
        });
    }
};
