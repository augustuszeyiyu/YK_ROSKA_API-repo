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
                order:  { type: 'string', pattern: /^ASC$|^DESC$/ },
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
	
    
    /** 在已知會組序號前提下，新增會組編號 **/
	{
        const schema_params = {
            type: 'object',
            properties: {
                sid:               {type: "string"},
            } 
        };
        const schema = {
			description: '在已知會組序號前提下，新增會組編號',
			summary: '在已知會組序號前提下，新增會組編號',
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
            const {rows:[group_serials]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1`, [sid]); 
            if (group_serials === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }


            let group_sql_list:string[] = [];
            const startDate = new Date(group_serials.bit_start_time);
            for (let index = 1; index <= group_serials.cycles; index++) {
                 const gid = generateNextGid('sid', startDate.toISOString().substring(0, 10)); // Generate gid based on the start date
                const bit_start_time = new Date(startDate); // Clone the start date
                bit_start_time.setMonth(startDate.getMonth() + index - 1, 10); // Set the 10th of the corresponding month
  

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

    function generateNextSid(last_group_id:string) {
        let  currentPrefix = last_group_id.substring(1,2);
        let  currentNumber = Number(last_group_id.substring(2, last_group_id.length));
        
        
        // Increment the number and handle prefix changes
        currentNumber++;
        if (currentNumber > 9999) {
            currentNumber = 1; // Reset the number to '1'
            currentPrefix = String.fromCharCode(currentPrefix.charCodeAt(0) + 1); // Increment the prefix character
        }
        
        // Create the ID by combining the prefix, number, and date
        const sid = `Y${currentPrefix}${currentNumber.toString().padStart(4, '0')}`;
        console.log(sid);
        return sid;
    }

    function generateNextGid(sid:string, start_date:string) {
       const new_date = getPreviousWeekday( start_date );

        const gid = `${sid}-${new_date}`;
        console.log(gid);

        return gid;
    }

    function getPreviousWeekday(date:string) {
        // Create a new Date object for the given epoch timestamp
        const currentDate = new Date(date);
      
        // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const currentDayOfWeek = currentDate.getDay();
      
        // Check if the current day is a weekend (Saturday or Sunday)
        if (currentDayOfWeek === 0 || currentDayOfWeek === 6) {
          // If it's a weekend, subtract the appropriate number of days to get the previous Friday (5)
          const daysToSubtract = currentDayOfWeek === 0 ? 2 : 1;
          currentDate.setDate(currentDate.getDate() - daysToSubtract);
        }
      
        // Return the date of the previous weekday (which may be the same date if it's not a weekend)
        const today = new Date(currentDate);
        const year = `${today.getFullYear() % 100}`.padStart(2, '0'); // Ensure 2 digits for year
        const month = (today.getMonth() + 1).toString().padStart(2, '0'); // Ensure 2 digits for month
        const day = today.getDate().toString().padStart(2, '0'); // Ensure 2 digits for day
        const yymmdd = `${year}${month}${day}`;
        return yymmdd;
      }
};
