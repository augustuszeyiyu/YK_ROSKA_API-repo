import fs from 'fs';
import path from 'path';
import TrimId from 'trimid';
import * as ExcelJS from 'exceljs';
import { PGDelegate } from 'pgdelegate';
import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import { BaseError, FileError } from '/lib/error';
import { RoskaSerials } from '/data-type/groups';
import { User } from '/data-type/users';
import { MAX_FILE_SIZE_BYTES } from '/lib/constants';

import Config from '/config.default.js';
import { SysVar } from '/data-type/sysvar';

export = async function(fastify: FastifyInstance) {
	/** 系統設定檔列表 **/
	{
		const schema = {
			description: '系統設定檔列表',
			summary: '系統設定檔列表',
            params: {
                type: 'object',
                properties: {},
            },
            param: {
                type: 'object',
                properties: {
                    file: { type: 'string', format: 'binary' },
                },
                required: ['file'],
            },
            security: [{ bearerAuth: [] }],
		};

        //@ts-ignore
		fastify.get('/sysvar', {schema}, async (req, res) => {
            const {rows:[row]} = await Postgres.query<{jsonb_object_agg:object}>(`SELECT jsonb_object_agg(key, value) FROM sysvar;`);
            
            res.status(200).send(row.jsonb_object_agg);
        });
	}
    /** 修改系統設定檔 **/
    {
        const schema = {
			description: '修改系統設定檔',
			summary: '修改系統設定檔',
            body: {
                type: 'object',
                properties: {
                    members_range:  { type: 'array', items:{ type: 'number' }, minItems:2, maxItems:2 },
                    handling_fee:   { type: 'number'},
                    transition_fee: { type: 'number'},
                    interest_bonus: { type: 'number'},
                },
            },
            security: [{ bearerAuth: [] }],
		};

        type BodyPayload = {
            members_range: number[],
            handling_fee: number,
            transition_fee: number,
            interest_bonus: number,
        }

        //@ts-ignore
		fastify.post<{Body:Partial<BodyPayload>}>('/sysvar', {schema}, async (req, res) => {
           
            const payload = req.body;
            const updaet_data = {} as Partial<BodyPayload>;

            if (payload.members_range !== undefined) {
                updaet_data.members_range = payload.members_range;
            }
            if (payload.handling_fee !== undefined) {
                updaet_data.handling_fee = payload.handling_fee;
            }
            if (payload.transition_fee !== undefined) {
                updaet_data.transition_fee = payload.transition_fee;
            }
            if (payload.interest_bonus !== undefined) {
                updaet_data.interest_bonus = payload.interest_bonus;
            }

            const sql_list:string[] = [];
            for (const key in updaet_data) {
                const value = JSON.stringify(updaet_data[key]);

                const sql = PGDelegate.format(`
                    INSERT INTO sysvar(key, value) 
                    VALUES ({key}, {value})
                    ON CONFLICT (key) 
                    DO UPDATE SET value = {value};`,
                    {key, value});

                sql_list.push(sql);
            }
           
            await Postgres.query(`${sql_list.join('\n')}`);

            res.status(200).send({});
        });
    }
};
