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
    
	/** POST /api/auth/password/forgot
	 *	- 變更忘記密碼之前，檢查用戶身份
	**/;
    {
        const schema = {
			description: '變更忘記密碼之前，檢查用戶身份',
			summary: '變更忘記密碼之前，檢查用戶身份',
			body:{
				type: 'object',
				properties: {
                    nid:        			{ type: 'string' },
                    contact_mobile_number: 	{ type: 'string' },
                },
                required: ['nid', 'contact_mobile_number']
            },
		};

		fastify.post<{Body:{nid:User['nid'], contact_mobile_number:User['contact_mobile_number']}}>('/password/forgot', {schema}, async(req, res)=>{
            const {nid, contact_mobile_number} = req.body;
			
			const {rows:[user]} = await Postgres.query<User>(`SELECT * FROM users WHERE nid=$1 AND contact_mobile_number=$2;`, [nid, contact_mobile_number]);
			if (user === undefined) {
				return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS);
			}

			const currentDate = new Date();
			const TOKEN_INFO = {
				tid:  TrimId.NEW.toString(32),
				uid:  user.uid,
				iss:  'YK5-RESET-PASSWORD',
				exp:   Date.now() + (30 * 60 * 1000)
			};

			const token = BWT.GenBWT(TOKEN_INFO, Config.secret.session);

			
			res.status(200).send({token});
		});
	}
	/** POST /api/auth/password/forgot/reset
	 *	- 變更忘記密碼
	**/;
    {
        const schema = {
			description: '變更忘記密碼',
			summary: '變更忘記密碼',
			body:{
                type: 'object',
				properties: {
                    token: { type: 'string' },
                    new_passwrod: { type: 'string' },
                },
                required: ['token', 'new_passwrod']
            },
		};

		fastify.post<{Body:{token:string, new_passwrod:string}}>('/password/forgot/reset', {schema}, async(req, res)=>{
            const {token, new_passwrod} = req.body;


			if (isValidPassword(new_passwrod) === false) {
                return res.errorHandler(UserError.INVALID_NEW_PASSWORD_FORMAT);
            }


			const token_info = BWT.ParseBWT<RoskaSessToken>(token, Config.secret.session);
			if (!token_info) {
				return res.errorHandler(LoginError.INVALID_TOKEN);
			}

			const is_expired = token_info.exp < Date.now();
			if (is_expired === true) {
				return res.errorHandler(LoginError.TOKEN_EXPIRED);
			}

			await Postgres.query(`UPDATE users SET password = $1 WHERE uid=$2;`, [new_passwrod, token_info?.uid]);
			await Postgres.query(`UPDATE login_sessions SET revoked=true, revoked_time=NOW() WHERE uid=$1;`, [token_info?.uid]);
            


			res.status(200).send();
		});
	}
};
