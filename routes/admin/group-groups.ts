import $ from "shared-storage";
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaCandidate, RoskaGroups, RoskaGroupsRequiredInfo, RoskaMembers, RoskaSerials, RoskaSerialsRequiredInfo } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { ErrorCode } from "/lib/error-code";
import { BaseError } from "/lib/error";
import { INT_POSSITIVE_STR_FORMAT } from "/data-type/common-helpers";
import { GroupError } from "/lib/error/gruop-error";


export = async function(fastify: FastifyInstance) {
    /** 會組 gid 列表 **/
    {
        const schema_query = {
            type: 'object',
            properties:{
                order:  { type: 'string' },
                p:      { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
                ps:     { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
            },
            required:['order', 'p', 'ps'],
        };
        const schema = {
			description: '會組 gid 列表',
			summary: '會組 gid 列表',
            querystring: Object.assign(
                schema_query, 
                {examples:[
                    { order:'ASC', p:'1', ps:'10' },
                    { order:'DESC', p:'2', ps:'10' }
                ]}
            ),
            security: [{ bearerAuth: [] }],
		};
        const PayloadValidator = $.ajv.compile(schema_query);
        type PaginateCursorUser = PaginateCursor<RoskaGroups[]>;
        fastify.get<{Querystring:{order:'ASC'|'DESC', p:string, ps:string}}>('/group-groups', {schema}, async (req, res)=>{
            if ( !PayloadValidator(req.query) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }


            const {uid, role}= req.session.token!;

            const {order, p, ps} = req.query;
			const _PageNumber = p && parseInt(p)>0? parseInt(p) : 1;
			const _PageSize = !ps? 30 : (ps && parseInt(ps)<30? 30: (ps && parseInt(ps) > 150 ? 150 : parseInt(ps)));
  			const _PageOffset = ((_PageNumber-1) * _PageSize);

            

			let sql_count = `SELECT COUNT(*) FROM roska_groups;`;
			let sql = `SELECT * FROM roska_groups ORDER BY gid ${order} `;
			const val:any[] = [];



			const result:PaginateCursorUser = {
				records: [],
				meta: {
					page: _PageNumber,
					page_size: _PageSize,
					total_records: 0,
					total_pages: 0
				}
			};
			


            const {rows} = await Postgres.query(sql_count); 
			let total_records = 0;
            if (Number(rows[0].count) > 0) {
                total_records = Number(rows[0].count);
            }
            else {
                return res.status(200).send(result);
            }


			{
				val.push(_PageOffset);
				sql += ` OFFSET $${val.length} `;
			}
			

			{
				val.push(_PageSize);
				sql += ` FETCH NEXT $${val.length} ROWS ONLY;`;
			}


			console.log(sql, val);
			
					
            const {rows:records} = await Postgres.query(sql, val);
            result.records = records;
            result.meta.total_records = total_records;
            result.meta.total_pages = Math.ceil(total_records / _PageSize);
			

            res.status(200).send(result); 
        });
    }

    /**  會組序號 sid 下的 會組 gid 列表 **/
    {
        const schema = {
			description: '會組序號 sid 下的 會組 gid 列表',
			summary: '會組序號 sid 下的 會組 gid 列表',
            params: {
                type: 'object',
                properties:{
                    sid: {type: 'string'}
                },
                required:["sid"],
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaGroups['sid']}}>('/group-groups/:sid', {schema}, async (req, res)=>{
            const {uid, role} = req.session.token!;


            const {sid} = req.params;
            const {rows} = await Postgres.query(`
                SELECT g.*, s.member_count, s.basic_unit_amount, s.min_bid_amount, s.max_bid_amount, s.bid_unit_spacing, s.frequency
                FROM roska_groups g
                LEFT JOIN roska_serials s ON s.sid = g.sid
                WHERE g.sid=$1;
            `, [sid]);
            
            return res.status(200).send(rows); 
        });
    }
	
    
    /** 產每期會組編號 **/
	{
        const schema_params = {
            type: 'object',
            properties: {
                sid:               {type: "string"},
            } 
        };
        const schema = {
			description: '產每期會組編號',
			summary: '產每期會組編號',
            params: schema_params,
            security: [{ bearerAuth: [] }],
		};

        const PayloadValidator1 = $.ajv.compile(schema_params);
		fastify.post<{Params:{sid:RoskaGroups['sid']}}>('/group-groups/:sid', {schema}, async (req, res)=>{
            if ( !PayloadValidator1(req.params) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator1.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }


            const {uid}:{uid:User['uid']} = req.session.token!;

  
            const {sid} = req.params;
            const {rows:[group_serials]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1 ORDER BY sid;`, [sid]); 
            if (group_serials === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }

            console.log();
            
            let group_sql_list:string[] = [];
            const startTime = new Date(group_serials.bid_start_time);
            for (let index = 1; index <= group_serials.cycles; index++) {

                // NOTE: Generate gid
                const gid = `${sid}-t`  + `${index}`.padStart(2, '0');

                // NOET: Calculate Start Time
                let bid_start_time:Date;
                if (group_serials.frequency === 'monthly') {
                    bid_start_time = calculateMonthlyBitStartTime(startTime, index);
                } 
                else {
                    bid_start_time = calculateBiWeeklyBitStartTime(startTime, index)
                }

                console.log(bid_start_time);
                
                // Add the member information to the list
                const payload:Partial<RoskaGroups> = { gid, sid, bid_start_time: new Date(bid_start_time).toISOString() }
                group_sql_list.push(PGDelegate.format(`
                    INSERT INTO roska_groups (${Object.keys(payload).join(', ')})
                    VALUES (${Object.keys(payload).map(e => `{${e}}` ).join(', ')});`, payload)
                );
            }
            

           await Postgres.query(group_sql_list.join('\n'));

            
			res.status(200).send({});
		});
	}

    {
        const schema = {
			description: '新增會員入會',
			summary: '新增會員入會',
            params: {
                type: 'object',
				properties: {
                    uid: { type: 'string' },
                    sid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.post<{Params:{uid:User['uid'], sid:RoskaSerials['sid']}}>('/group-groups/member/:uid/:sid', {schema}, async (req, res)=>{


            const {uid, sid} = req.params;


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
			description: '下標',
			summary: '下標',
            params: {
                type: 'object',
				properties: {
                    sid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaGroups['sid']}}>('/group-members/:sid', {schema}, async (req, res)=>{

            const {sid} = req.params;

            
            const {rows} = await Postgres.query(
                `SELECT m.mid, m.sid, m.uid, u.contact_mobile_number, u.address
                FROM roska_members m 
                LEFT JOIN users u ON m.uid=u.uid
                WHERE m.sid=$1
                GROUP BY m.mid, m.sid, m.uid, u.contact_mobile_number, u.address
                ORDER BY m.mid ASC;`,[sid]);

            return res.status(200).send(rows);
        });
    }

    /** 開標 gid **/
    {
        const schema = {
            description: '開標 gid',
            summary: '開標 gid',
            params: {
                type: 'object',
                properties:{
                    gid: {type: 'string'}
                },
                required:["gid"],
            },
            security: [{ bearerAuth: [] }],
        };

        fastify.get<{Params:{gid:RoskaGroups['gid']}}>('/group-bid/:gid', {schema}, async (req, res)=>{
            const {uid, role} = req.session.token!;

            const {gid} = req.params;
            const {rows:member_info} = await Postgres.query<RoskaMembers>(`SELECT * FROM roska_members WHERE gid=$1 AND win=false ORDER BY bid_amount DESC;`, [gid]);

            const {rows:[roska_serial]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1;`, [member_info[0].sid]);

            console.log(roska_serial.bid_unit_spacing, roska_serial.max_bid_amount);
            

            const candidate:RoskaCandidate[] = []; 
            
            for (let index = roska_serial.max_bid_amount; index > roska_serial.min_bid_amount; index-=roska_serial.bid_unit_spacing) {

                for (const {uid, mid, gid, sid, bid_amount} of member_info) {

                    if (roska_serial.max_bid_amount === bid_amount) {
                        candidate.push({uid, mid, gid, sid, bid_amount});
                    }                    
                }

                if (candidate.length > 0) break;                
            }

            const winner = shuffleCandidate(candidate);
            console.log(winner);
            
            
            return res.status(200).send({});
        });
    }

    function isWeekend(date) {
        // Check if the day of the week is Saturday (6) or Sunday (0).
        return date.getDay() === 0 || date.getDay() === 6;
    }
      
    function calculateMonthlyBitStartTime(bid_start_time:Date, index:number):Date {
        console.log(bid_start_time);
        
        // Calculate Start Time with month and year rollover and weekend avoidance
        const newMonth = bid_start_time.getMonth() + index;
        const yearOffset = Math.floor(newMonth / 12); // Calculate how many years to add
        const monthInYear = newMonth % 12; // Calculate the month within the year
        console.log({newMonth, yearOffset, monthInYear});
        

        const newYear = bid_start_time.getFullYear() + yearOffset;
        let newDate = new Date(newYear, monthInYear, 10);

        console.log({newYear, newDate});

        // Check if the calculated date is a weekend
        if (isWeekend(newDate) === true) {
            if (newDate.getDay() === 0) { // If it's Sunday
                // Subtract 2 days to schedule it on the previous Friday.
                newDate.setDate(newDate.getDate() - 2);
            } else if (newDate.getDay() === 6) { // If it's Saturday
                // Subtract 1 day to schedule it on the previous Friday.
                newDate.setDate(newDate.getDate() - 1);
            }
        }
      
        return newDate; // Return the adjusted bid_start_time
    }

    function calculateBiWeeklyBitStartTime(bid_start_time:Date, index:number) {
        // Calculate the number of days to add for biweekly scheduling
        const daysToAdd = (index - 1) * 14; // 14 days for biweekly (2 weeks)
      
        // Add the calculated days to the start date
        bid_start_time.setDate(bid_start_time.getDate() + daysToAdd);
      

        // Check if the calculated date is a weekend
        if (isWeekend(bid_start_time) === true) {
            if (bid_start_time.getDay() === 0) { // If it's Sunday
                // Subtract 2 days to schedule it on the previous Friday.
                bid_start_time.setDate(bid_start_time.getDate() - 2);
            } else if (bid_start_time.getDay() === 6) { // If it's Saturday
                // Subtract 1 day to schedule it on the previous Friday.
                bid_start_time.setDate(bid_start_time.getDate() - 1);
            }
        }
      
        return bid_start_time;
    }
     
    function shuffleCandidate(array:RoskaCandidate[]) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
    }
};
