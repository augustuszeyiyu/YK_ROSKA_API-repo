/**
 *	Author: cheny
 *	Create: 2023-09-29
**/
import $ from "shared-storage";
import Config from '/config.default.js';
import {FastifyInstance} from "fastify";
import {PGDelegate} from "pgdelegate";
import {BaseError, LoginError, UserError} from '/lib/error.js';
import {LOGIN_SESSION_DURATION} from '/lib/constants.js';
import Postgres from '/data-source/postgres.js';
import BWT from "/lib/web-token.js";
import TrimId from 'trimid';
import { User } from '/data-type/users.js';




export = async function(fastify:FastifyInstance) {
    /** @see file://./../_docs/auth-session-control.md **/
	/** GET /auth/session
	 *	- 取得登入資訊
	**/;
    {
        const schema = {
			description: '取得網頁 cookie, 判斷 cookie 是否過期，如果過期，就需要回傳新的 cookie',
			summary: '取得網頁 cookie, 判斷 cookie 是否過期，如果過期，就需要回傳新的 cookie',
			params: {},
		};

		type ResponseType = {
			access_token: 	string;
			login_time: 	number;
			expired_time: 	number;
		};
		fastify.get('/session', {schema}, async(req, res)=>{
			if (!req.session.is_login) return res.errorHandler( BaseError.UNAUTHORIZED_ACCESS );
			

			const token = req.session.token!;
			const raw_token:string = req.session.raw_token!;
			
			let count:number=0;
			const Pg = await Postgres.zone('login_sessions', async(Pg)=>{
				count = await Pg.CountDocument({id: token.tid});
			});

			if ( count === 0 ) {
				return res.errorHandler( BaseError.UNAUTHORIZED_ACCESS);
			}		

			const result:ResponseType = {
				access_token: 	raw_token,
				login_time: 	token.iat,
				expired_time: 	token.exp,
			};

			res.status(200).send(result);
		});
	}

	/** POST /auth/login
	 *	- 登入
	**/
	{
		const schema = {
			description: '使用身分證字號和密碼登入',
			summary: '使用身分證字號和密碼登入',
			body: {
				type: 'object',
                properties: {
					nid:      { type: 'string' },
                    password: { type: 'string' },
				},
				examples: [{
					nid: 'S123456789',
					password: 'password',
				}]
			}
		};


		type ResponseType = {
			access_token:string;
			refresh_token:string;
			expired_time:epoch;
			login_time:epoch;
		};

		fastify.post<{Body:{nid:User['nid'], password:User['password']}, Reply:APIResponse<ResponseType>}>('/login', {schema}, async(req, res)=>{
			const {nid, password} = req.body;
			
			
			{
				if ( nid === undefined ) {
					return res.errorHandler(UserError.INVALID_ACCOUNT)
				} 
				if ( password === undefined ) {
					return res.errorHandler(UserError.INVALID_PASSWORD);
				}
			}

			let user_id:string, user_role:string;
			{
				// NOTE: check password
				try {
					// NOTE: verify user password
					const {rows:[row]} = await Postgres.query<{uid:User['uid'], role:User['role']}>(`SELECT (verify_password($1, $2)).*;`, [nid, password]);				
					if (row === undefined) {
						return res.errorHandler( UserError.INVALID_PASSWORD );
					}
					user_id   = row.uid;
					user_role = row.role;
				} catch (error) {
					return res.errorHandler( UserError.INVALID_PASSWORD );
				}
			}
		


			// NOTE: Generate JWT Token
			const TOKEN_INFO:RoscaSessToken = {
				tid: TrimId.NEW.toString(32),
				uid: user_id!,
				role: user_role,
				iss: 'YK5-ROSKA',
				iat: Date.unix(),
				exp: Date.unix() + LOGIN_SESSION_DURATION,
			};
			const AUTH_DATA = {
				id: 			TOKEN_INFO.tid,
				uid: 			TOKEN_INFO.uid,
				role:			TOKEN_INFO.role,
				login_time: 	TOKEN_INFO.iat,
				expired_time: 	TOKEN_INFO.exp,
			};
			console.log('===============>', TOKEN_INFO, AUTH_DATA);	
			const token = BWT.GenBWT(TOKEN_INFO, Config.secret.session);
			console.log('===============>', token);
			


			// NOTE: Query auth info for updating or Insert a new auth document
			const sql = PGDelegate.format(`INSERT INTO login_sessions(${Object.keys(AUTH_DATA)}) VALUES (${Object.keys(AUTH_DATA).map(e => `{${e}}` ).join(', ')})`, AUTH_DATA);
			console.log(sql);			
			const result = await Postgres.query(sql);
			console.log(result);

		

			const REFRESH_INFO:HuntRefreshToken = {
				tid: TOKEN_INFO.tid,
				exp: TOKEN_INFO.exp + LOGIN_SESSION_DURATION
			};
			const refresh_token = BWT.GenBWT(REFRESH_INFO, Config.secret.session);
			console.log(refresh_token);


			res.setCookie(Config.cookie.cookie_session_id, token, {
				path:'/',
				httpOnly:true,
				expires:new Date(AUTH_DATA.expired_time*1000),
				domain: Config.cookie.domain || undefined
			})
			.status(200)
			.send({
				access_token:token,
				refresh_token:refresh_token,
				expired_time:AUTH_DATA.expired_time,
				login_time:AUTH_DATA.login_time
			});
		});
	}

	/** GET /auth/logout
	 *	- 登出
	**/
	// TODO: Change method get to delete
    {
        const schema = {
            description: '登出',
            summary: '登出',
            params: {}
        };
        fastify.get('/logout', {schema}, async(req, res)=>{
            if (req.session.is_login === true) {
                const token = req.session.token!;

                const sql = PGDelegate.format(`UPDATE login_sessions SET revoked={revoked} AND revoked_time={revoked_time} WHERE id={id};`, {id:token.tid, revoked:true, revoked_time: Date.unix()});
                await Postgres.query(sql);
            }
        
            res.setCookie(Config.cookie.cookie_session_id, '', {
                path:'/',
                httpOnly:true,
                expires:new Date(),
                domain: Config.cookie.domain || undefined
            })
            .status(200)
            .send({});
        });
    }
};
