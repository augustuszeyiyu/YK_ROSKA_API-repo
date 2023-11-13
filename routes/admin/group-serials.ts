import $ from "shared-storage";
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { GroupFrequency, RoskaSerials, RoskaSerialsRequiredInfo } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { ErrorCode } from "/lib/error-code";
import { BaseError } from "/lib/error";
import { GenWhiteListPattern, INT_POSSITIVE_STR_FORMAT } from "/data-type/common-helpers";


export = async function(fastify: FastifyInstance) {
    /** 產會組序號 sid **/
    {
        const schema_body = {
            type: 'object',
            properties: {
                member_count:       {type: "number"},
                basic_unit_amount:  {type: "number"},
                min_bid_amount:     {type: "number"},
                max_bid_amount:     {type: "number"},
                bid_unit_spacing:   {type: "number"},
                bit_start_time:     {type: "string"},
                frequency:          {type: "string", pattern: GenWhiteListPattern([...Object.values(GroupFrequency)]).source },
            },
            required: ['member_count', 'basic_unit_amount', 'min_bid_amount', 'max_bid_amount', 'bid_unit_spacing', 'bit_start_time', 'frequency']
        };

        const schema = {
			description: '產會組序號，比如: YA0034，和一組新的會組編號',
			summary: '產會組序號，比如: YA0034，和一組新的會組編號',
            body: {
                type: 'object',
                properties: schema_body.properties,
                required: schema_body.required, 
                examples:[
                    {
                        member_count:25,
                        basic_unit_amount: 5000,
                        min_bid_amount: 200,
                        max_bid_amount: 1000,
                        bid_unit_spacing: 200,
                        bit_start_time: '2023-11-15',
                        frequency: 'monthly'
                    }
                ]
            },
            security: [{ bearerAuth: [] }],
		};

       
        const PayloadValidator = $.ajv.compile(schema_body);
		fastify.post<{Body:RoskaSerialsRequiredInfo}>('/group-serial', {schema}, async (req, res)=>{
            console.log(req.body);
            
            if ( !PayloadValidator(req.body) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }

            const {uid, role}= req.session.token!;
            const {member_count, basic_unit_amount, min_bid_amount, max_bid_amount, bid_unit_spacing, bit_start_time, frequency} = req.body;


            let _s= '', sid_prefix = '', sid_date = '';
            const {rows:[row_sid]} = await Postgres.query<{sid:RoskaSerials['sid']}>(`
                SELECT sid FROM roska_serials
                ORDER BY sid DESC;`);


            console.log({row_sid});
                
            if (row_sid === undefined)  _s = 'YA0000-';
            else                        _s = row_sid.sid;
            console.log({_s});
           
            
            // NOTE: YA0001-231001,  find YA0001 
            const _v = _s.split('-');
            sid_prefix = _v[0];
            sid_date = _v[1];
            let sid = generateNextSid(sid_prefix);
            console.log({sid});
            
            
            // NOTE: get year and month
            const inputDate = new Date('2023-11-15');
            const formattedDate = inputDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }).replace(/\//g, '');
            console.log({formattedDate}); // Output: 2311

            const {rows:[row_bit_time]} = await Postgres.query<{sid:RoskaSerials['sid']}>(`
                SELECT sid FROM roska_serials
                WHERE bit_start_time::date = $1
                ORDER BY sid DESC;`, [bit_start_time]);
            console.log({row_bit_time});
            
            
            if (row_bit_time === undefined) {
                sid = `${sid}-${formattedDate}01`;
            }
            else {
                const _r = row_bit_time.sid.split('-');
                const bit_date = `${Number(_r[1]) + 1}`.padStart(6, '0');

                sid = `${sid}-${bit_date}`;
            }
            
            console.log({sid});
            
            
            const payload:Partial<RoskaSerials> = {sid, uid};

            {
                if (member_count !== undefined)         {
                                                          payload.member_count = member_count;
                                                          payload.cycles = member_count-1;
                }
                if (basic_unit_amount !== undefined)    { payload.basic_unit_amount = basic_unit_amount; }
                if (min_bid_amount !== undefined)       { payload.min_bid_amount = min_bid_amount; }
                if (max_bid_amount !== undefined)       { payload.max_bid_amount = max_bid_amount; }
                if (bid_unit_spacing !== undefined)     { payload.bid_unit_spacing = bid_unit_spacing; }
                if (bit_start_time !== undefined)       { payload.bit_start_time = bit_start_time; }
                if (frequency !== undefined)            { payload.frequency = frequency; }
            }
            
            console.log(payload);
            
            const sql = PGDelegate.format(`
                INSERT INTO roska_serials(${Object.keys(payload).join(', ')}) 
                VALUES (${Object.keys(payload).map(e => `{${e}}` ).join(', ')}) 
                RETURNING *;`, payload);
            const {rows:[result]} = await Postgres.query<RoskaSerials>(sql);

            
			res.status(200).send({sid})
		});
    }
    /** 會組序號 sid 列表 **/
    {
        const schema = {
			description: '會組序號 sid 列表',
			summary: '會組序號 sid 列表',
            querystring: {
                type: 'object',
                properties:{
                    order:  { type: 'string' },
                    p:      { type: 'string' },
                    ps:     { type: 'string' },
                },
                required:['order', 'p', 'ps'],
                examples:[
                    { order:'ASC', p:'1', ps:'10' },
                    { order:'DESC', p:'2', ps:'10' }
                ]
            },
            security: [{ bearerAuth: [] }],
		};
        const schema_query = {
            type: 'object',
            properties:{
                order:  { type: 'string' },
                p:      { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
                ps:     { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
            },
            required:['order', 'p', 'ps'],
        };
        const PayloadValidator = $.ajv.compile(schema_query);
		type PaginateCursorUser = PaginateCursor<RoskaSerials[]>;
        fastify.get<{Querystring:{order:'ASC'|'DESC', p:string, ps:string}}>('/group-serial', {schema}, async (req, res)=>{
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

            

			let sql_count = `SELECT COUNT(*) FROM roska_serials;`;
			let sql = `SELECT * FROM roska_serials ORDER BY sid ${order} `;
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
            };


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
    /** 搜尋會組序號 sid **/
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

        fastify.get<{Params:{sid:RoskaSerials['sid']}}>('/group-serial/:sid', {schema}, async (req, res)=>{
            const {uid, role} = req.session.token!;

            const {sid} = req.params;
            const {rows:[row]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1;`, [sid]);

            return res.status(200).send(row);
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
