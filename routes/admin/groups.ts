import $ from "shared-storage";
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaGroups, RoskaGroupsRequiredInfo, RoskaMembers, RoskaSerials, RoskaSerialsRequiredInfo } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { ErrorCode } from "/lib/error-code";


export = async function(fastify: FastifyInstance) {
	/** 搜尋組團 **/
    {
        const schema = {
			description: '搜尋組團',
			summary: '搜尋組團',
            params: {
                type: 'object',
            },
		};

        fastify.get('/group', {schema}, async (req, res)=>{
            const {rows:[row]} = await Postgres.query(`SELECT * FROM roska_goups ORDER BY`)
        });
    }
    /** 產組團序號 **/
    {
        const schema_body = {
            type: 'object',
            properties: {
                basic_unit_amount:  {type: "number"},
                min_bid_amount:     {type: "number"},
                max_bid_amount:     {type: "number"},
                bid_unit_spacing:   {type: "number"},
                g_frequency:        {type: "number"},
            },
            required: ['basic_unit_amount', 'min_bid_amount', 'max_bid_amount', 'bid_unit_spacing', 'g_frequency']
        };

        const schema = {
			description: '產組團序號，比如: YA0034，和一組新的組團編號',
			summary: '產組團序號，比如: YA0034，和一組新的組團編號',
            body: schema_body,
		};

        const PayloadValidator = $.ajv.compile(schema_body);
		fastify.post<{Body:RoskaSerialsRequiredInfo}>('/group', {schema}, async (req, res)=>{
            if ( !PayloadValidator(req.query) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }

            const {uid, role}= req.session.token!;

            const {rows:[row]} = await Postgres.query<{sid:RoskaGroups['sid']}>(`SELECT sid FROM roska_serials ORDER BY sid DESC;`);
            
            let sid = generateNextSid(row.sid);
            if (sid === undefined)  sid = generateNextSid('YA0000');
            
        

            const {basic_unit_amount, min_bid_amount, max_bid_amount, bid_unit_spacing, g_frequency} = req.body;
            const payload:Partial<RoskaSerials> = {sid, uid};

            {
               

                if (basic_unit_amount !== undefined)    { payload.basic_unit_amount = basic_unit_amount; }
                if (min_bid_amount !== undefined)       { payload.min_bid_amount = min_bid_amount; }
                if (max_bid_amount !== undefined)       { payload.max_bid_amount = max_bid_amount; }
                if (bid_unit_spacing !== undefined)     { payload.bid_unit_spacing = bid_unit_spacing; }
                if (g_frequency !== undefined)          { payload.g_frequency = g_frequency; }
               
            }
            
            const sql = PGDelegate.format(`
                INSERT INTO roska_groups(${Object.keys(payload).join(', ')}) 
                VALUES (${Object.keys(payload).map(e => `{${e}}` ).join(', ')}) 
                RETURNING *;`, payload);
            const {rows:[result]} = await Postgres.query<RoskaGroups>(sql);

            
			res.status(200).send({sid})
		});
    }
    /** 在已知組團序號前提下，新增組團編號 **/
	{
        const schema_params = {
            type: 'object',
            properties: {
                sid:               {type: "string"},
                start_date:        {type: "string"},
            } 
        };
        const schema = {
			description: '在已知組團序號前提下，新增組團編號',
			summary: '在已知組團序號前提下，新增組團編號',
            params: schema_params,
		};

        const PayloadValidator1 = $.ajv.compile(schema_params);
		fastify.post<{Params:{sid:RoskaGroups['sid'], start_date:string}}>('/group/:sid/:start_date', {schema}, async (req, res)=>{
            if ( !PayloadValidator1(req.params) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator1.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }


            const {uid}:{uid:User['uid']} = req.session.token!;

  
            const {sid, start_date} = req.params;
            const {rows:[group_serials]} = await Postgres.query<RoskaSerials>(`SELECT * FROM roska_serials WHERE sid=$1`, [sid]); 
            if (group_serials === undefined) {
                return;
            }


            let group_sql_list:string[] = [];
            const startDate = new Date(start_date);
            for (let index = 1; index < 25; index++) {
                 const gid = generateNextGid('sid', startDate.toISOString().substring(0, 10)); // Generate gid based on the start date
                const bit_start_time = new Date(startDate); // Clone the start date
                const bit_end_time = new Date(startDate); // Clone the start date
                bit_start_time.setMonth(startDate.getMonth() + index - 1, 10); // Set the 10th of the corresponding month
                bit_end_time.setMonth(startDate.getMonth() + index - 1, 13); // Set the 13th of the corresponding month

                // Add the member information to the list
                const payload:Partial<RoskaGroups> = { gid, bit_start_time: new Date(bit_start_time).getTime(), bit_end_time: new Date(bit_end_time).getTime() }
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
