import $ from "shared-storage";
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaBids, RoskaCandidate, RoskaGroups, RoskaGroupsRequiredInfo, RoskaMembers, RoskaSerials, RoskaSerialsRequiredInfo } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { ErrorCode } from "/lib/error-code";
import { BaseError } from "/lib/error";
import { INT_POSSITIVE_STR_FORMAT, SORT_ORDER } from "/data-type/common-helpers";
import { GroupError } from "/lib/error/gruop-error";


export = async function(fastify: FastifyInstance) {
     /** 產會期編號 **/
	{
        const schema_params = {
            type: 'object',
            properties: {
                sid:               {type: "string"},
            } 
        };
        const schema = {
			description: '產會期編號',
			summary: '產會期編號',
            params: schema_params,
            security: [{ bearerAuth: [] }],
		};

        const PayloadValidator1 = $.ajv.compile(schema_params);
		fastify.post<{Params:{sid:RoskaGroups['sid']}}>('/group/group/:sid', {schema}, async (req, res)=>{
            if ( !PayloadValidator1(req.params) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator1.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }


  
            const {sid} = req.params;
            const {rows:[group_serial]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1 ORDER BY sid;`, [sid]); 
            if (group_serial === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }

            
            
            let group_sql_list:string[] = [];
            const startTime = new Date(group_serial.bid_start_time);
            for (let index = 1; index <= group_serial.cycles; index++) {

                // NOTE: Generate gid
                const gid = `${sid}-t`  + `${index}`.padStart(2, '0');

                // NOET: Calculate Start Time
                let bid_start_time:Date;
                if (group_serial.frequency === 'monthly') {
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
            
           
            const mid = `${sid}-00`;
            const first_member = PGDelegate.format(`
                INSERT INTO roska_members (mid, sid, uid) 
                VALUES({mid}, {sid}, {uid});`, 
                {mid, sid, uid:group_serial.uid}
            );
            group_sql_list.push(first_member);


            await Postgres.query(group_sql_list.join('\n'));
            
            
			res.status(200).send({});
		});
	}
    /** 全部會期 gid 列表 **/
    {
        const schema_query = {
            type: 'object',
            properties:{
                o:  { type: 'string', pattern: SORT_ORDER.source },
                p:  { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
                ps: { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
            },
            required:['o', 'p', 'ps'],
        };
        const schema = {
			description: '全部會期 gid 列表',
			summary: '全部會期 gid 列表',
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
        fastify.get<{Querystring:{o:'ASC'|'DESC', p:string, ps:string}}>('/group/group/all-list', {schema}, async (req, res)=>{
            if ( !PayloadValidator(req.query) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }


            const {o, p, ps} = req.query;
            const _order = o.trim().toUpperCase();
			const _PageNumber = p && parseInt(p)>0? parseInt(p) : 1;
			const _PageSize = !ps? 30 : (ps && parseInt(ps)<30? 30: (ps && parseInt(ps) > 150 ? 150 : parseInt(ps)));
  			const _PageOffset = ((_PageNumber-1) * _PageSize);

            

			let sql_count = `SELECT COUNT(*) FROM roska_groups;`;
			let sql = `
                SELECT  *, 
                        (CASE
                            WHEN bid_start_time > NOW() THEN '尚未開始'
                            WHEN bid_end_time >= NOW() AND NOW() >= bid_start_time THEN '進行中'
                            WHEN NOW() > bid_end_time THEN '已過期'
                        END) as state
                FROM roska_groups ORDER BY gid ${_order} `;
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

        fastify.get<{Params:{sid:RoskaGroups['sid']}}>('/group/group/list/:sid', {schema}, async (req, res)=>{

            const {sid} = req.params;
            const {rows} = await Postgres.query(`
                SELECT g.*, s.member_count, s.basic_unit_amount, s.min_bid_amount, s.max_bid_amount, s.bid_unit_spacing, s.frequency,
                    (CASE
                        WHEN g.bid_start_time > NOW() THEN '尚未開始'
                        WHEN g.bid_end_time >= NOW() AND NOW() >= g.bid_start_time THEN '進行中'
                        WHEN NOW() > g.bid_end_time THEN '已過期'
                    END) as state
                FROM roska_groups g
                LEFT JOIN roska_serials s ON s.sid = g.sid
                WHERE g.sid=$1
                ORDER BY g.gid, g.sid;
            `, [sid]);
            
            return res.status(200).send(rows); 
        });
    }

    /** 下標列表 */
    {
        const schema = {
			description: '下標列表',
			summary: '下標列表',
            params: {
                type: 'object',
				properties: {
                    gid: { type: 'string' }
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{gid:RoskaGroups['gid']}}>('/group/bid/list/:gid', {schema}, async (req, res)=>{

            const {gid} = req.params;


            const {rows} = await Postgres.query(
                `SELECT b.mid, b.sid, b.uid, b.bid_amount, u.name||RIGHT(mid, 3) as name
                FROM roska_bids b 
                INNER JOIN users u ON b.uid=u.uid
                WHERE b.gid=$1
                GROUP BY b.mid, b.sid, b.uid, u.name, b.bid_amount
                ORDER BY b.mid ASC;`,[gid]);

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

        fastify.get<{Params:{gid:RoskaGroups['gid']}}>('/group/bid/:gid', {schema}, async (req, res)=>{
            const {gid} = req.params;


            const {rows:[count_winner]} = await Postgres.query<{count:num_str}>(`SELECT COUNT(*) FROM roska_members WHERE gid=$1;`, [gid]);
            if (Number(count_winner.count) > 0) {
                return res.errorHandler(GroupError.DUPLICATE_BID);
            }

            
            const {rows:roska_bids} = await Postgres.query<RoskaBids>(`SELECT * FROM roska_bids WHERE gid=$1 ORDER BY bid_amount DESC;`, [gid]);
            if (roska_bids.length === 0) {
                return res.errorHandler(GroupError.NO_MEMBER_BID);
            }

            const sid = roska_bids[0].sid;
            const {rows:[roska_serial]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1;`, [sid]);

            console.log({roska_bid_count: roska_bids.length, bid_unit_spacing:roska_serial.bid_unit_spacing, max_bid_amount:roska_serial.max_bid_amount});
            

            const candidate:RoskaCandidate[] = []; 
            
            for (let index = Number(roska_serial.max_bid_amount); index >= Number(roska_serial.min_bid_amount); index-= Number(roska_serial.bid_unit_spacing)) {

                console.log({index});
                
                for (const {mid, gid, sid, uid, bid_amount} of roska_bids) {

                    console.log({mid, gid, sid, uid, bid_amount});
                    
                    if (roska_serial.max_bid_amount === bid_amount) {
                        candidate.push({mid, gid, sid, uid, bid_amount});
                    }                    
                }

                if (candidate.length > 0) break;                
            }

            const winner_index = Math.floor(Math.random() * candidate.length);
            const winner_candidate = candidate[winner_index];
            console.log({winner_index, winner_candidate});
            
            // NOTE: updaet roska_bids
            {
                const sql = PGDelegate.format(`
                    UPDATE roska_bids 
                    SET win = true 
                    WHERE   mid={mid} 
                        AND gid={gid}
                        AND sid={sid}
                        AND uid={uid}
                        AND bid_amount = {bid_amount};`, 
                    winner_candidate);

                console.log(sql);
                await Postgres.query(sql);
            }

            // NOTE: updaet roska_groups
            {
                const sql = PGDelegate.format(`
                    UPDATE roska_groups
                    SET mid = {mid},
                        uid = {uid},
                        bid_amount = {bid_amount},
                        win_time = NOW()
                    WHERE   gid={gid}
                        AND sid={sid};`, 
                    winner_candidate);

                console.log(sql);
                
                await Postgres.query(sql);
            }

            // NOTE: updaet roska_members
            {
                const {rows:[live_die]} = await Postgres.query<{live:num_str, die:num_str}>(`
                    SELECT 
                        COUNT(CASE WHEN gid = '' THEN 1 END) AS live,
                        COUNT(CASE WHEN gid <> '' THEN 1 END) AS die
                    FROM roska_members
                    WHERE sid = $1;`, [sid]);

                const live_member_count = Number(live_die.live) - 1;
                const die_member_count  = Number(live_die.die)  + 1;
                const basic_unit_amount = Number(roska_serial.basic_unit_amount);
                const bit_amount        = Number(winner_candidate.bid_amount);

                const update_member = {
                    mid: winner_candidate.mid,
                    sid: winner_candidate.sid,
                    uid: winner_candidate.uid,
                    gid: winner_candidate.gid,
                    win_amount: (live_member_count * (basic_unit_amount - bit_amount)) + (die_member_count * basic_unit_amount)
                }

                const sql = PGDelegate.format(`
                    UPDATE roska_members
                    SET gid = {gid},
                        uid = {uid},
                        win_amount = {win_amount},
                        win_time = NOW()
                    WHERE   mid = {mid}
                        AND uid = {uid}
                        AND sid = {sid}
                    RETURNING *;`, 
                    update_member);

                await Postgres.query(sql);                
            }

            {
                const {rows:[row]} = await Postgres.query(`
                    SELECT m.*, u.name||RIGHT(mid, 3) as name
                    FROM roska_members m
                    INNER JOIN users u ON m.uid=u.uid
                    WHERE m.gid = $1;`, [gid]);

                res.status(200).send(row);
            }
            
           
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
};
