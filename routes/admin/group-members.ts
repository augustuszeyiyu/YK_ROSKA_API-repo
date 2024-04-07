import $ from "shared-storage";
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { GroupError } from "/lib/error/gruop-error";
import { UserError } from "/lib/error";


type PaginateCursorUser = PaginateCursor<RoskaSerials[]>;

export = async function(fastify: FastifyInstance) {
    /* 新增會員入會 */
    {
        const schema = {
			description: '新增會員入會',
			summary: '新增會員入會',
            body: {
                type: 'object',
				properties: {
                    contact_mobile_number: { type: 'string' },
                    sid: { type: 'string' }
                },
                required: ['sid']
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{contact_mobile_number:User['contact_mobile_number'], sid:RoskaSerials['sid']}}>('/group/member', {schema}, async (req, res)=>{
            const {contact_mobile_number, sid} = req.body;


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
                required: ['sid']
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{contact_mobile_numbers:User['contact_mobile_number'][], sid:RoskaSerials['sid']}}>('/group/members', {schema}, async (req, res)=>{
            const {contact_mobile_numbers, sid} = req.body;


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

            let insert_sql:string[] = [];
            for (let index = 0; index < USERS.length; index++) {
                const next = `${total_members+index}`.padStart(2, '0');
                const mid = `${sid}-${next}`;
                
                const USER = USERS[index];
                const sql = PGDelegate.format(`INSERT INTO roska_members (mid, sid, uid) VALUES({mid}, {sid}, {uid});`, {mid, sid, uid:USER.uid});
                insert_sql.push(sql);
            }
        
            
    
            await Postgres.query(insert_sql.join(', '));

          
            
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
    /** 會員轉讓 **/
    {
        const schema = {
			description: '多名會員轉讓',
			summary: '多名會員轉讓',
            body: {
                type: 'object',
                properties:{
                    sid:  {type: 'string'},
                    mids: {
                        type: 'array', 
                        items: { type: 'string' }
                    }
                },
                required:["sid", "mids"],
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Body:{sid:String, mids:RoskaMembers['mid'][]}}>('/group/member/transition', {schema}, async (req, res)=>{
            const {sid, mids} = req.body;
            
            await Postgres.query<RoskaSerials>(`UPDATE roska_members SET transition = 1 WHERE sid=$1 AND mid = ANY($2);`, [sid, mids]);
            
            return res.status(200).send({});
        });
    }
};
