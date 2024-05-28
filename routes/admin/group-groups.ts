import $ from "shared-storage";
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaBids, RoskaCandidate, RoskaDetails, RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { ErrorCode } from "/lib/error-code";
import { BaseError, UserError } from "/lib/error";
import { INT_POSSITIVE_STR_FORMAT, SORT_ORDER } from "/data-type/common-helpers";
import { GroupError } from "/lib/error/gruop-error";
import { SysVarControl } from "/lib/sysvar";
import { SysVar } from "/data-type/sysvar";
import { QueryResult } from "pg";
import { cal_win_amount } from "/lib/cal-win-amount";


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
            for (let index = 0; index <= group_serial.cycles; index++) {

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
                
                if (index === 0) {
                    // Add the member information to the list
                    const payload:Partial<RoskaGroups> = {
                         gid, sid, mid:`${sid}-00`, uid:group_serial.uid, 
                         bid_amount: group_serial.basic_unit_amount * group_serial.cycles, 
                         bid_start_time: new Date(bid_start_time).toISOString(), 
                         win_time: new Date().toISOString() 
                    }
                    
                    group_sql_list.push(PGDelegate.format(`
                        INSERT INTO roska_groups (${Object.keys(payload).join(', ')})
                        VALUES (${Object.keys(payload).map(e => `{${e}}` ).join(', ')});`, payload)
                    )
                    console.log(group_sql_list);
                    
                }
                else {
                    // Add the member information to the list
                    const payload:Partial<RoskaGroups> = { gid, sid, bid_start_time: new Date(bid_start_time).toISOString() }
                    group_sql_list.push(PGDelegate.format(`
                        INSERT INTO roska_groups (${Object.keys(payload).join(', ')})
                        VALUES (${Object.keys(payload).map(e => `{${e}}` ).join(', ')});`, payload)
                    );
                }
            }
            
            // NOTE: insert firt member
            const mid = `${sid}-00`;
            const first_member = PGDelegate.format(`
                INSERT INTO roska_members (mid, sid, uid, gid, win_amount, win_time) 
                VALUES({mid}, {sid}, {uid}, {gid}, {win_amount}, NOW());`, 
                {mid, sid, uid:group_serial.uid, gid:`${sid}-t00`, win_amount: group_serial.basic_unit_amount * group_serial.cycles},
            );
            console.log(first_member);
            
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
            const _order = o === undefined? 'ASC': o.trim().toUpperCase();
			const _PageNumber = p && parseInt(p)>0? parseInt(p) : 1;
			const _PageSize = !ps? 30 : (ps && parseInt(ps)<30? 30: (ps && parseInt(ps) > 150 ? 150 : parseInt(ps)));
  			const _PageOffset = ((_PageNumber-1) * _PageSize);

            

			let sql_count = `SELECT COUNT(*) FROM roska_groups `;
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
            body: {
                type: 'object',
                properties:{
                    gid: {type: 'string'},
                    assign_to_uid: {type: 'string'},
                },
                required:["gid"],
            },
            security: [{ bearerAuth: [] }],
        };

        fastify.post<{Body:{gid:RoskaGroups['gid']}}>('/group/bid', {schema}, async (req, res)=>{
            const {gid} = req.body;


            // NOTE: query handling_fee, transition_fee, interest_bonus
            const {rows:sysvar} = await Postgres.query<SysVar>(`SELECT * FROM sysvar WHERE key in ('handling_fee', 'transition_fee', 'interest_bonus') ORDER BY key ASC;`);           
            const handling_fee = Number(sysvar[0].value);
            const transition_fee = Number(sysvar[1].value);
            const interest_bonus = Number(sysvar[2].value);
            console.log({handling_fee, transition_fee, interest_bonus});


            const {rows:[group_info]} = await Postgres.query<Partial<RoskaGroups>&Partial<RoskaSerials&{available:number}>>(`
                SELECT g.gid, g.bid_start_time, g.bid_end_time, g.mid, g.uid, g.bid_amount, g.win_time, g.win_amount, 
                       s.sid, s.member_count, s.cycles, s.basic_unit_amount, s.min_bid_amount, s.max_bid_amount, s.bid_unit_spacing, s.frequency,
                (
                    SELECT COUNT(*) 
                    FROM roska_groups
                    WHERE sid=s.sid AND uid='' AND mid = ''
                ) as available
                FROM roska_groups g
                INNER JOIN roska_serials s ON g.sid=s.sid
                WHERE g.gid=$1;`, [gid]);
            
            console.log(group_info);
            

            if (group_info === undefined) {
                return res.errorHandler(GroupError.GID_NOT_FOUND);
            }

            if (group_info.uid !== '' || group_info.uid !== '') {
                return res.errorHandler(GroupError.DUPLICATE_BID);
            }
            
            console.log({bid_unit_spacing:group_info.bid_unit_spacing, max_bid_amount:group_info.max_bid_amount});

            if (group_info.sid === undefined) {
                return res.errorHandler(GroupError.SID_NOT_FOUND);
            }

            const sid = group_info.sid;
            const candidate:RoskaCandidate[] = [];
            let   winner_index = 0, winner_candidate = {} as RoskaCandidate;


            const {rows:roska_bids} = await Postgres.query<RoskaBids&{transition:RoskaMembers['transition'], assign_mid:RoskaBids['mid'], assign_uid:RoskaBids['uid'], assign_bid:RoskaBids['bid_amount']}>(`
                SELECT b.*, m.transition, r.mid AS assign_mid, r.uid AS assign_uid, r.bid_amount AS assign_bid
                FROM roska_bids b
                INNER JOIN roska_members m ON m.mid = b.mid
                LEFT JOIN roska_bids r ON b.gid = r.gid AND r.win = true
                WHERE b.gid = $1
                ORDER BY b.bid_amount DESC;
            `, [gid]);
            console.log('1', {roska_bid_count: roska_bids.length, bid_unit_spacing:group_info.bid_unit_spacing, max_bid_amount:group_info.max_bid_amount, roska_bids});   

           
            // NOTE: 指定得獎者
            if (roska_bids.length > 0 && roska_bids[0].assign_mid !== null && group_info.uid === '') {                
                winner_candidate = {
                    gid, sid,
                    mid: roska_bids[0].assign_mid,
                    uid: roska_bids[0].assign_uid,
                    bid_amount: Number(roska_bids[0].assign_bid),
                    transition: roska_bids[0].transition,
                    win_amount: 0
                };
            }
            else
            // NOTE: 無人投標
            if (roska_bids.length === 0 && group_info.uid === '') {
                const {rows:available_members} = await Postgres.query<RoskaMembers>(`
                    SELECT * 
                    FROM roska_members 
                    WHERE sid=$1 AND gid='';`, [sid]);

                console.log(available_members.length);
                
                if (available_members.length === 0) {
                    return res.errorHandler(GroupError.DUPLICATE_BID);
                }
                else {
                    const avail_member = available_members[0];
                    winner_candidate = {
                        gid: gid,
                        sid: avail_member.sid,
                        mid: avail_member.mid,
                        uid: avail_member.uid,
                        bid_amount: 1000,
                        transition: avail_member.transition,
                        win_amount: 0
                    }
                }                
            }
            // NOTE: 正常開標
            else {
                for (let index = Number(group_info.max_bid_amount); index >= Number(group_info.min_bid_amount); index-= Number(group_info.bid_unit_spacing)) {
                    console.log({index});
                    
                    for (const {mid, gid, sid, uid, bid_amount, transition} of roska_bids) {
    
                        console.log({mid, gid, sid, uid, bid_amount});
                        
                        if (group_info.max_bid_amount === bid_amount) {
                            candidate.push({
                                gid, sid, mid, uid, 
                                bid_amount:Number(bid_amount),
                                transition: transition,
                                win_amount: 0
                            });
                        }                    
                    }
    
                    if (candidate.length > 0) break;                
                }
    
                winner_index = Math.floor(Math.random() * candidate.length);
                winner_candidate = candidate[winner_index];
            }
            
            winner_candidate.win_amount = cal_win_amount(handling_fee, interest_bonus, transition_fee, group_info.cycles!, group_info.basic_unit_amount!, winner_candidate.bid_amount, gid, winner_candidate.transition)
           
            console.log({winner_index, winner_candidate});            

            
            {
                // NOTE: updaet roska_groups
                const sql = PGDelegate.format(`
                    UPDATE
                        roska_groups
                    SET
                        mid = {mid}, uid = {uid}, bid_amount = {bid_amount}, win_time = NOW(), win_amount = {win_amount}
                    WHERE
                        gid = {gid} AND
                        sid = {sid} AND
                        NOW() > bid_end_time
                    RETURNING *;`, 
                    winner_candidate
                );
                
                const {rowCount} = await Postgres.query(sql);
                console.log(sql, rowCount);
                if (rowCount === 0) {
                    return res.errorHandler(GroupError.NOT_PAST_BID_END_TIME);
                }
            }

            // NOTE: updaet roska_bids
            {
                console.log('HERE');
                
                const sql = PGDelegate.format(`
                    UPDATE  
                        roska_bids 
                    SET     
                        win = true 
                    WHERE   
                        mid = {mid} AND
                        uid = {uid} AND
                        gid = {gid} AND
                        sid = {sid}
                    RETURNING *;`, 
                    winner_candidate);
                const {rowCount} = await Postgres.query(sql);
                console.log(sql, rowCount);
            }


            // NOTE: insert roska_details
            {
                let total_earn = 0;
                let promise_list:string[] = [];
                const basic_unit_amount = Number(group_info.basic_unit_amount);

                const {rows:rosroska_members} = await Postgres.query<RoskaMembers>(`SELECT * FROM roska_members WHERE sid=$1 ORDER BY mid ASC;`, [sid]);
                for (const member of rosroska_members) {
                    if (member.mid === `${sid}-00`) {
                        const detail:Partial<RoskaDetails> = {
                            sid, gid,
                            mid: member.mid,
                            uid: member.uid,
                            live: false,
                            profit: -basic_unit_amount,
                        };

                        const sql = PGDelegate.format(`
                            INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                            VALUES ({sid}, {gid}, {mid}, {uid}, {live}, {profit})
                            ON CONFLICT (mid, uid, gid, sid) DO NOTHING;
                        `, detail);
                        console.log(detail, sql);
                        
                        promise_list.push(sql);
                    }
                    else
                    if (member.mid !== winner_candidate.mid && member.gid !== '') {
                        const detail = {
                            sid, gid,
                            mid: member.mid,
                            uid: member.uid,
                            live: false,
                            profit: -basic_unit_amount,
                            handling_fee: 0,
                            transition_fee: 0,
                        };

                        const sql = PGDelegate.format(`
                            INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                            VALUES ({sid}, {gid}, {mid}, {uid}, {live}, {profit})
                            ON CONFLICT (mid, uid, gid, sid) DO NOTHING;
                        `, detail);
                        console.log(detail, sql);
                        
                        promise_list.push(sql);
                    }
                    else 
                    if (member.mid !== winner_candidate.mid && member.gid === '') {
                        const detail = {
                            sid, gid,
                            mid: member.mid,
                            uid: member.uid,
                            live: true,
                            profit: -(basic_unit_amount - winner_candidate.bid_amount),
                        };

                        const sql = PGDelegate.format(`
                            INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                            VALUES ({sid}, {gid}, {mid}, {uid}, {live}, {profit})
                            ON CONFLICT (mid, uid, gid, sid) DO NOTHING;
                        `, detail);
                        console.log(detail, sql);
                        
                        promise_list.push(sql);
                    }
                } // for end

                {
                    // NOTE: 更新得標者資料
                    const detail:Partial<RoskaDetails> = {
                        sid, gid,
                        mid: winner_candidate.mid,
                        uid: winner_candidate.uid,
                        live: false,
                        profit: winner_candidate.win_amount,
                        handling_fee: handling_fee,
                        transition_fee: winner_candidate.transition === 1? transition_fee: 0,
                        interest_bonus: winner_candidate.transition === 1? interest_bonus: 0,
                    };


                    const sql = PGDelegate.format(`
                        INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                        VALUES ({sid},{gid},{mid},{uid},{live},{profit},{handling_fee},{transition_fee},{interest_bonus})
                        ON CONFLICT (mid, uid, gid, sid) DO NOTHING;
                    `, detail);
                    promise_list.push(sql);


                    const member = PGDelegate.format(`
                        UPDATE  
                            roska_members
                        SET     
                            gid = {gid},
                            win_amount = {win_amount},
                            win_time = NOW()
                        WHERE   
                            mid = {mid} AND
                            uid = {uid} AND
                            sid = {sid}
                        RETURNING *;`,
                        winner_candidate);

                    promise_list.push(member);
                }
                
                console.log(promise_list);
                
                await Postgres.query(promise_list.join('\n'));
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
    /** 指定得標者 **/
    {
        const schema = {
            description: '指定得標者',
            summary: '指定得標者',
            body: {
                type: 'object',
                properties:{
                    gid: {type: 'string'},
                    assign_to_uid: {type: 'string'},                    
                },
                required:["gid", "assign_to_uid"],
            },
            security: [{ bearerAuth: [] }],
        };

        fastify.post<{Body:{gid:RoskaGroups['gid'], assign_to_uid:RoskaMembers['uid']}}>('/group/bid/assign', {schema}, async (req, res)=>{
            const {gid, assign_to_uid} = req.body;
            
            const {rows:remove_old_winner} = await Postgres.query<RoskaBids>(`
                UPDATE  roska_bids
                SET     win = false
                WHERE   gid = $1 
                    AND win = true;`, [gid]);


            const {rows:[assign_new_winner]} = await Postgres.query<RoskaBids>(`
                    UPDATE  roska_bids
                    SET     win = true
                    WHERE   gid = $1 
                        AND uid = $2
                    RETURNING *;`, [gid, assign_to_uid]);
            
         
            return res.status(200).send(assign_new_winner);
        })
    }
    /** 轉讓得標 **/
    {
        const schema = {
            description: '轉讓得標',
            summary: '轉讓得標',
            body: {
                type: 'object',
                properties:{
                    gid: {type: 'string'},
                    assign_to_uid: {type: 'string'},
                    assign_from_uid: {type: 'string'},                    
                },
                required:["gid", "assign_to_uid", "assign_from_uid"],
            },
            security: [{ bearerAuth: [] }],
        };

        fastify.post<{Body:{gid:RoskaGroups['gid'], assign_to_uid:RoskaMembers['uid'], assign_from_uid:RoskaMembers['uid']}}>('/group/bid/transfer', {schema}, async (req, res)=>{
            const {gid, assign_to_uid, assign_from_uid} = req.body;

            // NOTE: 檢查得標者是否存在
            const {rows:[group_info]} = await Postgres.query<RoskaGroups&RoskaSerials>(`
                    SELECT * 
                    FROM roska_groups g
                    INNER JOIN roska_serials s ON g.sid = s.sid
                    WHERE g.gid = $1 AND g.uid = $2;`, [gid, assign_from_uid]);
            
            if (group_info === undefined) {
                return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS, [assign_from_uid]);
            }
            console.log({bid_unit_spacing:group_info.bid_unit_spacing, max_bid_amount:group_info.max_bid_amount});
            
            
            const sid = group_info.sid;

            const {rows:users_bid_info} = await Postgres.query<RoskaBids&{win_amount:RoskaMembers['win_amount'], transition:RoskaMembers['transition']}>(`
                SELECT  *, m.win_amount, m.transition
                FROM  roska_members b
                INNER JOIN roska_members m ON m.uid = b.uid
                WHERE   sid = $1 
                    AND gid = $2
                    AND uid = ANY($2);`, [sid, gid, [assign_to_uid, assign_from_uid]]);

            
            if (users_bid_info.length < 2) {
                if (users_bid_info[0].uid !== assign_to_uid) {
                    return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS, [assign_to_uid]);
                } 
                else 
                if (users_bid_info[1].uid !== assign_from_uid) {
                    return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS, [assign_from_uid]);
                }
                else {
                    return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS, [assign_to_uid, assign_from_uid]);
                }
            }
            
            
            
            const old_winner = users_bid_info[1];
            const new_winner = users_bid_info[0];
            const old_winner_candidate:RoskaCandidate = {
                sid: group_info.sid, 
                gid: group_info.gid,
                mid: old_winner.mid,
                uid: old_winner.uid,
                bid_amount: old_winner.bid_amount,
                win_amount: 0,
                transition: old_winner.transition
            }

            const winner_candidate:RoskaCandidate = {
                sid: group_info.sid, 
                gid: group_info.gid,
                mid: new_winner.mid,
                uid: new_winner.uid,
                bid_amount: new_winner.bid_amount,
                win_amount: old_winner.win_amount,
                transition: new_winner.transition
            }
            // NOTE: remvove old data
            {
                await Postgres.query<RoskaGroups&RoskaSerials>(`
                DELETE FROM roska_details WHERE gid=$1 AND sid=$2`, [gid, sid]);

                const update_groups_sql = PGDelegate.format(`
                    UPDATE 
                        roska_groups
                    SET 
                        mid = {mid},
                        uid = {uid},
                        win_amount = {win_amount}
                    WHERE
                        sid = {sid} AND
                        gid = {gid} AND
                        mid = {from_mid} AND
                        uid = {from_uid} RETURNING *;`, 
                    Object.assign(winner_candidate, {
                        from_mid: old_winner_candidate.mid,
                        from_uid: old_winner_candidate.uid,
                    }));

                const update_old_bid_sql = PGDelegate.format(`
                    UPDATE 
                        roska_bids
                    SET win = false
                    WHERE
                        gid={gid} AND
                        sid={sid} AND
                        mid={mid} AND
                        uid={uid} RETURNING *;`, 
                        old_winner_candidate);

                const update_new_bid_sql = PGDelegate.format(`
                    UPDATE 
                        roska_bids 
                    SET 
                        win = true 
                    WHERE
                        gid={gid} AND
                        sid={sid} AND
                        mid={mid} AND
                        uid={uid} RETURNING *;`, 
                    winner_candidate);

                const update_old_member_sql = PGDelegate.format(`
                    UPDATE 
                        roska_members
                    SET     
                        win_amount = 0
                    WHERE
                        gid={gid} AND
                        sid={sid} AND
                        mid={mid} AND
                        uid={uid} RETURNING *;`, 
                    old_winner_candidate);   
                console.log({update_groups_sql});

                //@ts-ignore
                const [{rows:[update_groups]}, {rows:[update_old_bid]}, {rows:[update_new_bid]}, {rows:[update_old_member]}] = await Postgres.query([
                    update_groups_sql, update_old_bid_sql, update_new_bid_sql, update_old_member_sql].join('\n')
                    ) as Promise<QueryResult<any>[]>;
            }     

            // NOTE: insert roska_details
            {
                const {rows:sysvar} = await Postgres.query<SysVar>(`SELECT * FROM sysvar WHERE key in ('handling_fee', 'transition_fee', 'interest_bonus') ORDER BY key ASC;`);
                console.log({sysvar});
                const handling_fee = Number(sysvar[0].value);
                const transition_fee = Number(sysvar[1].value);
                const interest_bonus = Number(sysvar[2].value)
       

                let total_earn = 0;
                let promise_list:string[] = [];
                const basic_unit_amount = Number(group_info.basic_unit_amount);


                let transition:string = '0';
                const {rows:rosroska_members} = await Postgres.query<RoskaMembers>(`SELECT * FROM roska_members WHERE sid=$1 ORDER BY mid ASC;`, [sid]);
                for (const member of rosroska_members) {
                    if (member.mid === `${sid}-00`) {
                        const detail = {
                            sid, gid,
                            mid: member.mid,
                            uid: member.uid,
                            live: false,
                            profit: 0,
                            pay: basic_unit_amount,
                            handling_fee: 0,
                            transition_fee: 0,
                        };
                        total_earn += detail.pay - detail.handling_fee;

                        const sql = PGDelegate.format(`
                            INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                            VALUES ({sid},{gid},{mid},{uid},{live},{earn},{pay},{handling_fee},{transition_fee});
                        `, detail);
                        
                        promise_list.push(sql);
                    }
                    else
                    if (member.mid !== winner_candidate.mid && member.gid !== '') {
                        transition = String(member.transition);

                        const detail = {
                            sid, gid,
                            mid: member.mid,
                            uid: member.uid,
                            live: false,
                            profit: 0,
                            pay: group_info.basic_unit_amount!,
                            handling_fee: handling_fee,
                            transition_fee: 0,
                        };
                        total_earn += detail.pay - detail.handling_fee;

                        const sql = PGDelegate.format(`
                            INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                            VALUES ({sid},{gid},{mid},{uid},{live},{earn},{pay},{handling_fee},{transition_fee});
                        `, detail);
                        
                        promise_list.push(sql);
                    }
                    else 
                    if (member.mid !== winner_candidate.mid && member.gid === '') {
                        const detail = {
                            sid, gid,
                            mid: member.mid,
                            uid: member.uid,
                            live: true,
                            profit: 0,
                            pay: basic_unit_amount - winner_candidate.bid_amount,
                            handling_fee: 0,
                            transition_fee: 0,
                        };
                        total_earn += detail.pay - detail.handling_fee;

                        const sql = PGDelegate.format(`
                            INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                            VALUES ({sid},{gid},{mid},{uid},{live},{earn},{pay},{handling_fee},{transition_fee});
                        `, detail);
                        
                        promise_list.push(sql);
                    }
                } // for end

                {
                    const total_earn = cal_win_amount(handling_fee, transition_fee, interest_bonus, group_info.cycles, group_info.basic_unit_amount, group_info.bid_amount, gid, winner_candidate.transition);
                    // NOTE: 更新得標者資料
                    const detail = {
                        sid, gid,
                        mid: winner_candidate.mid,
                        uid: winner_candidate.uid,
                        live: false,
                        profit: total_earn,
                        handling_fee: winner_candidate.transition === 1? handling_fee: 0,
                        transition_fee: winner_candidate.transition === 1? transition_fee: 0,
                        interest_bonus: winner_candidate.transition === 1? interest_bonus: 0,
                    };
                   

                    const sql = PGDelegate.format(`
                        INSERT INTO roska_details (${Object.keys(detail).join(', ')})
                        VALUES ({sid},{gid},{mid},{uid},{live},{profit},{handling_fee},{transition_fee},{interest_bonus});
                    `, detail);

                    promise_list.push(sql);

                    
                    const member = PGDelegate.format(`
                        UPDATE  roska_members
                        SET     gid = {gid},
                                win_amount = {win_amount},
                                win_time = NOW(),
                        WHERE   mid = {mid}
                            AND uid = {uid}
                            AND sid = {sid}
                        RETURNING *;`,
                        Object.assign(winner_candidate, {win_amount:total_earn}));

                    promise_list.push(member);
                }
                
                await Postgres.query(promise_list.join('\n'));                
            }
   

            return res.status(200).send({});
        })
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
