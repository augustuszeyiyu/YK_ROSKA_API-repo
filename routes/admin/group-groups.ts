import $ from "shared-storage";
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaGroups, RoskaGroupsRequiredInfo, RoskaMembers, RoskaSerials, RoskaSerialsRequiredInfo } from '/data-type/groups';
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
                SELECT g.*, s.member_count, s.basic_unit_amount, s.min_bid_amount, s.max_bid_amount, s.bid_unit_spacing, s.g_frequency
                FROM roska_goups g
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


            let group_sql_list:string[] = [];
            const startTime = new Date(group_serials.bit_start_time);
            for (let index = 1; index <= group_serials.cycles; index++) {

                // NOTE: Generate gid
                const gid = `${sid}-t`  + `${index}`.padStart(2, '0');

                // NOET: Calculate Start Time
                let bit_start_time:Date;
                if (group_serials.frequency === 'monthly') {
                    bit_start_time = calculateMonthlyBitStartTime(startTime, index);
                } 
                else {
                    bit_start_time = calculateBiWeeklyBitStartTime(startTime, index)
                }

                console.log(bit_start_time);
                
                // Add the member information to the list
                const payload:Partial<RoskaGroups> = { gid, sid, bit_start_time: new Date(bit_start_time).toISOString() }
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
        const schema_body = {
            type: 'object',
            properties: {
                basic_unit_amount:  {type: "number"},
                min_bid_amount:     {type: "number"},
                max_bid_amount:     {type: "number"},
                bid_unit_spacing:   {type: "number"},
                bit_start_time:     {type: "number"},
                bit_end_time:       {type: "number"},
                g_frequency:        {type: "number"},
            }
        };
        const schema = {
			description: '加入改團，新增會員入團',
			summary: '加入改團，新增會員入團',
            params: {
                description: '加入改團，新增會員入團',
                type: 'object',
				properties: {
                    gid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        const PayloadValidator1 = $.ajv.compile(schema_body);
        fastify.post<{Params:{gid:RoskaGroups['gid']}}>('/group/member/:gid', {schema}, async (req, res)=>{
            const {uid}:{uid:User['uid']} = req.session.token!;

            const {gid} = req.params;
            
            const {rows:[row]} = await Postgres.query(`SELECT mid FROM roska_members WHERE gid=$1 AND join_time=0 ORDER BY mid ASC LIMIT 1;`, [gid]);
            await Postgres.query<RoskaMembers>(`UPDATE roska_members SET uid=$1, joing_time=$2 WHERE mid=$3 AND gid=$4 RETURNING *;`, [uid, Date.unix(), gid, row.mid]);

            
			res.status(200).send({gid});
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

    function isWeekend(date) {
        // Check if the day of the week is Saturday (6) or Sunday (0).
        return date.getDay() === 0 || date.getDay() === 6;
    }
      
    function calculateMonthlyBitStartTime(bit_start_time:Date, index:number):Date {
        // Calculate Start Time with month and year rollover and weekend avoidance
        const newMonth = bit_start_time.getMonth() + index;
        const yearOffset = Math.floor(newMonth / 12); // Calculate how many years to add
        const monthInYear = newMonth % 12; // Calculate the month within the year
        console.log({newMonth, yearOffset, monthInYear});
        

        const newYear = bit_start_time.getFullYear() + yearOffset;
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
      
        return newDate; // Return the adjusted bit_start_time
    }

    function calculateBiWeeklyBitStartTime(bit_start_time:Date, index:number) {
        // Calculate the number of days to add for biweekly scheduling
        const daysToAdd = (index - 1) * 14; // 14 days for biweekly (2 weeks)
      
        // Add the calculated days to the start date
        bit_start_time.setDate(bit_start_time.getDate() + daysToAdd);
      

        // Check if the calculated date is a weekend
        if (isWeekend(bit_start_time) === true) {
            if (bit_start_time.getDay() === 0) { // If it's Sunday
                // Subtract 2 days to schedule it on the previous Friday.
                bit_start_time.setDate(bit_start_time.getDate() - 2);
            } else if (bit_start_time.getDay() === 6) { // If it's Saturday
                // Subtract 1 day to schedule it on the previous Friday.
                bit_start_time.setDate(bit_start_time.getDate() - 1);
            }
        }
      
        return bit_start_time;
    }
      
};
