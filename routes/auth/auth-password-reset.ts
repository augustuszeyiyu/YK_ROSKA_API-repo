/**
 *	Author: cheny
 *	Create: 2023-09-29
**/
import $ from "shared-storage";
import Config from '/config.default.js';
import {FastifyInstance} from "fastify";
import {PGDelegate} from "pgdelegate";
import {create as svgCaptcha_create} from 'svg-captcha';
import {BaseError, LoginError, UserError} from '/lib/error.js';
import {LOGIN_SESSION_DURATION} from '/lib/constants.js';
import Postgres from '/data-source/postgres.js';
import BWT from "/lib/web-token.js";
import TrimId from 'trimid';
import { User, isValidNewResidentID, isValidPassword, isValidTaiwanNationalID } from '/data-type/users.js';




export = async function(fastify:FastifyInstance) {
    
	/** POST /api/auth/password/reset
	 *	- 變更密碼
	**/;
    {
        const schema = {
			description: '變更密碼',
			summary: '變更密碼',
			body:{
                type: 'object',
				properties: {
                    old_passwrod: { type: 'string' },
                    new_passwrod: { type: 'string' },
                },
                required: ['old_passwrod', 'new_passwrod']
            },
			security: [{ bearerAuth: [] }],
		};

		fastify.post<{Body:{old_passwrod:string, new_passwrod:string}}>('/password/reset', {schema}, async(req, res)=>{
            const {old_passwrod, new_passwrod} = req.body;
			const {tid, uid, role} = req.session.token!;
			
            
            if (isValidPassword(new_passwrod) === false) {
                return res.errorHandler(UserError.INVALID_NEW_PASSWORD_FORMAT);
            }

            const {rows:[IS_VALID]} = await Postgres.query<{uid:User['uid'], role:User['role']}>(`SELECT (verify_password($1, $2)).*;`, [uid, old_passwrod]);
            if (IS_VALID === undefined) {
                return res.errorHandler( UserError.INVALID_PASSWORD );
            }
            


            if (IS_VALID.uid === uid && IS_VALID.role === role) {
                await Postgres.query(`UPDATE users SET password = $1 WHERE uid=$2;`, [new_passwrod, uid]);
                await Postgres.query(`UPDATE login_sessions SET revoked=true, revoked_time=NOW() WHERE id=$1;`, [tid]);
            }



			res.status(200).send();
		});
	}
};
