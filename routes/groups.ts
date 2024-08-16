import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaBids, RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { BaseError, LoginError, UserError } from '/lib/error';
import { GroupError } from "/lib/error/gruop-error";
import { SysVar } from "/data-type/sysvar";


export = async function(fastify: FastifyInstance) {
    /** 新成立會組列表 **/
    {
        const schema = {
			description: '新成立會組列表',
			summary: '新成立會組列表',
            params: {},
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/serial/new-list', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            
            const {rows} = await Postgres.query<RoskaSerials>(`
                SELECT * FROM roska_serials 
                WHERE bid_start_time >= NOW()
                ORDER BY sid ASC`);
            return res.status(200).send(rows);
        });
    }
    /** 進行中的會組列表 **/
    {
        const schema = {
			description: '進行中的會組列表',
			summary: '進行中的會組列表',
            params: {},
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/serial/on-list', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }
            const {uid} = req.session.token!;
            
            const {rows} = await Postgres.query<RoskaSerials>(`
                SELECT DISTINCT s.sid, s.* ,m.mid
                FROM roska_members m
                INNER JOIN roska_serials s ON m.sid = s.sid
                WHERE m.uid = $1 AND bid_start_time < NOW() AND bid_end_time > NOW()
                ORDER BY s.sid;`, [uid]);
            return res.status(200).send(rows);
        });
    }
    /** 搜尋該會組會期 **/
    {
        const schema = {
			description: '搜尋該會組會期',
			summary: '搜尋該會組會期',
            params: {
                type: 'object',
                properties:{
                    sid: {type: 'string'}
                }
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{sid:RoskaGroups['sid']}}>('/group/group/:sid', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }
            const {uid} = req.session.token!;
            

            const {sid} = req.params;
            const {rows} = await Postgres.query(`SELECT * FROM roska_groups WHERE sid=$1 ORDER BY gid ASC`, [sid]);

            return res.status(200).send(rows);
        });
    }
    /** 各會期結算列表 **/
    {

        const schema_params = {
            type: 'object',
            properties: {
                year: { type: 'number' },
                month: { type: 'number' }
            },

        };
        const schema = {
			description: '各會期結算列表',
			summary: '各會期結算列表',
            params: schema_params,
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{uid:string, year:number, month:number}}>('/group/group/settlement-list/:year/:month', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            const {uid} = req.session.token!;
            const {year, month} = req.params!;
            console.log(req.params);
            console.log({uid, year, month});


            const {rows:user_transition_info} = await Postgres.query<{
                sid:RoskaMembers['sid'], 
                mid:RoskaMembers['mid'], 
                basic_unit_amount: RoskaSerials['basic_unit_amount'],
                cycles:RoskaSerials['cycles'],
                current_cycles:number,
                transition:RoskaMembers['transition'], 
                transit_to:RoskaMembers['transit_to'],
                total: number,
                group_info: (Partial<RoskaGroups>&{win:boolean, subtotal:number})[],
            }>(`
                WITH filter_group_info AS (
                    SELECT DISTINCT 
                        m.mid,
                        m.uid,
                        m.sid, 
                        s.basic_unit_amount,
                        s.cycles,
                        m.transition,
                        m.transit_to,
                        COALESCE(
                            (
                                SELECT
                                    jsonb_agg( jsonb_build_object(
                                        'gid', rg.gid,
                                        'mid', rg.mid,
                                        'uid', rg.uid,
                                        'bid_end_time', rg.bid_end_time,
                                        'win_amount', (CASE 
                                            WHEN rg.gid = m.gid THEN rg.win_amount
                                            WHEN m.gid = ''     THEN -(s.basic_unit_amount - rg.bid_amount)
                                            WHEN rg.gid < m.gid THEN -(s.basic_unit_amount - rg.bid_amount)
                                            ELSE (CASE WHEN m.transition = 1 OR m.transition = 2 THEN 0 ELSE -s.basic_unit_amount END) END)
                                    ) ORDER BY rg.gid, rg.sid)
                                FROM 
                                    roska_groups rg
                                WHERE 
                                    rg.sid = m.sid AND 
                                    rg.mid <> '' AND 
                                    EXTRACT(YEAR FROM bid_end_time) <= $2 AND
                                    EXTRACT(MONTH FROM bid_end_time) <= $3
                            ), '[]'::jsonb) AS group_info
                    FROM 
                        roska_members m
                    INNER JOIN 
                        roska_serials s ON m.sid=s.sid
                    WHERE 
                        m.uid = $1
                    ORDER BY 
                        m.sid
                    )
                    select * from filter_group_info
                    where jsonb_array_length(group_info) > 0;`, [uid, year, month]);


            return res.status(200).send(user_transition_info);
            
        //     const {rows:user_transition_info} = await Postgres.query<{
        //         sid:RoskaMembers['sid'], 
        //         basic_unit_amount: RoskaSerials['basic_unit_amount'],
        //         cycles:RoskaSerials['cycles'],
        //         transition:RoskaMembers['transition'], 
        //         transit_to:RoskaMembers['transit_to'],
        //         total: number,
        //         group_info: (Partial<RoskaGroups>&{win:boolean, subtotal:number})[],
        //     }>(`
        //         SELECT DISTINCT 
        //         m.mid,
        //         m.uid,
        //         m.sid,
        //         s.basic_unit_amount,
        //         s.cycles,
        //         s.bid_start_time,
        //         m.transition,
        //         m.transit_to,
        //         COALESCE(
        //             (
        //                 SELECT
        //                     jsonb_agg( jsonb_build_object(
        //                         'gid', rg.gid, 
        //                         'win_amount', (CASE 
        //                             WHEN rg.gid = m.gid THEN rg.win_amount
        //                             WHEN m.gid = ''     THEN -(s.basic_unit_amount - rg.bid_amount)
        //                             WHEN rg.gid < m.gid THEN -(s.basic_unit_amount - rg.bid_amount)
        //                             ELSE (CASE WHEN m.transition = 1 OR m.transition = 2 THEN 0 ELSE -s.basic_unit_amount END) END)
        //                     ) ORDER BY rg.gid, rg.sid)
        //                 FROM 
        //                     roska_groups rg
        //                 WHERE 
        //                     rg.sid = m.sid AND 
        //                     rg.mid <> ''
        //             ), '[]'::jsonb) AS group_info
        //         FROM 
        //             roska_members m
        //         INNER JOIN 
        //             roska_serials s ON m.sid=s.sid
        //         WHERE 
        //             m.mid IN (SELECT mid FROM roska_members WHERE uid = $1)
        //         ORDER BY 
        //             m.sid;`, [uid]);


        //     return res.status(200).send(user_transition_info);

        });
    }
    /** 各會期結算 **/
    {
        const schema = {
			description: '各會期結算',
			summary: '各會期結算',
            params: {
                type: 'object',
                properties:{
                    year:  {type: 'number'},
                    month: {type: 'number'}
                },
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get<{Params:{year:number, month:number}}>('/group/serial/settlement/:year_month', {schema}, async (req, res)=>{
            if (req.session.is_login === false) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            const {uid} = req.session.token!;
            const {year, month} = req.params;
            console.log({year, month});


            const {rows:user_transition_info} = await Postgres.query<{
                sid:RoskaMembers['sid'], 
                basic_unit_amount: RoskaSerials['basic_unit_amount'],
                cycles:RoskaSerials['cycles'],
                transition:RoskaMembers['transition'], 
                transit_to:RoskaMembers['transit_to'],
                total: number,
                group_info: (Partial<RoskaGroups>&{win:boolean, subtotal:number})[],
            }>(`
                SELECT DISTINCT 
                    m.mid,
                    m.uid,
                    m.sid, 
                    s.basic_unit_amount,
                    s.cycles,
                    m.transition,
                    m.transit_to,
                    COALESCE(
                        (
                            SELECT
                                jsonb_agg( jsonb_build_object(
                                    'gid', rg.gid, 
                                    'bid_amount', rg.bid_amount,
                                    'win_amount', (CASE 
                                        WHEN rg.gid = m.gid THEN rg.win_amount
                                        WHEN m.gid = ''     THEN -(s.basic_unit_amount - rg.bid_amount)
                                        WHEN rg.gid < m.gid THEN -(s.basic_unit_amount - rg.bid_amount)
                                        ELSE (CASE WHEN m.transition = 1 OR m.transition = 2 THEN 0 ELSE -s.basic_unit_amount END) END)
                                ) ORDER BY rg.gid, rg.sid)
                            FROM 
                                roska_groups rg
                            WHERE 
                                rg.sid = m.sid AND 
                                rg.mid <> '' AND 
                                EXTRACT(YEAR FROM win_time) <= $2 AND
                                EXTRACT(MONTH FROM win_time) <= $3
                        ), '[]'::jsonb) AS group_info
                FROM 
                    roska_members m
                INNER JOIN 
                    roska_serials s ON m.sid=s.sid
                WHERE 
                    m.uid = $1
                ORDER BY 
                    m.sid;`, [uid, year, month]);


            return res.status(200).send(user_transition_info);
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

            const {rows:[row]} = await Postgres.query<RoskaBids>(sql);

            return res.status(200).send(row);
        });   
    }
};
