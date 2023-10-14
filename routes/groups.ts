import payload = require('/package.json');
import { FastifyInstance, FastifyReply, FastifyRequest, FastifySchema } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { RoskaGroups, RoskaMembers, RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { PGDelegate } from 'pgdelegate';
import { BaseError, LoginError, UserError } from '/lib/error';


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
            const {uid} = req.session.token!;
            if (uid === undefined) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            
            const {rows:[row]} = await Postgres.query<RoskaSerials>(`
                SELECT * FROM roska_serials 
                WHERE bit_start_time >= NOW()
                ORDER BY sid ASC`);
            return res.status(200).send(row);
        });
    }
    /** 進行中的會組 **/
    {
        const schema = {
			description: '進行中的會組',
			summary: '進行中的會組',
            params: {},
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/serial/on-list', {schema}, async (req, res)=>{
            const {uid} = req.session.token!;
            if (uid === undefined) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            
            const {rows:[row]} = await Postgres.query<RoskaSerials>(`
                SELECT s.*, g.bit_start_time as g_bit_start_time, g.bit_end_time as g_bit_end_time
                FROM roska_groups g
                LEFT JOING roska_serials s ON s.sid = g.sid
                WHERE NOW() <= g.bit_start_time AND NOW() >= g.bit_end_time
                ORDER BY sid ASC`);
            return res.status(200).send(row);
        });
    }

    /** 新成立會組列表 **/
    {
        const schema = {
			description: '新成立會組列表',
			summary: '新成立會組列表',
            params: {},
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/serial/list', {schema}, async (req, res)=>{
            const {uid} = req.session.token!;
            if (uid === undefined) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }

            
            const {rows:[row]} = await Postgres.query<RoskaSerials>(`
                SELECT * FROM roska_serials 
                WHERE NOW() <= bit_start_time
                ORDER BY sid ASC`);
            return res.status(200).send(row);
        });
    }

    /** 搜尋組團 **/
    {
        const schema = {
			description: '搜尋組團',
			summary: '搜尋組團',
            params: {
                type: 'object',
                properties:{
                    gid: {type: 'string'}
                }
            },
            security: [{ bearerAuth: [] }],
		};

        fastify.get('/group/group/:gid', {schema}, async (req, res)=>{
            const {uid} = req.session.token!;
            if (uid === undefined) {
                res.errorHandler(BaseError.UNAUTHORIZED_ACCESS);
            }


            const {rows:[row]} = await Postgres.query(`SELECT * FROM roska_goups ORDER BY gid DESC`);
        });
    }


    {
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
            const {uid}:{uid:User['uid']} = req.session.token!;
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

};
