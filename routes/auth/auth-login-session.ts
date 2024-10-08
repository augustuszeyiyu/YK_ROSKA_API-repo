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
    /** @see file://./../_docs/auth-session-control.md **/
	/** GET /auth/session
	 *	- 取得登入資訊
	**/;
    {
        const schema = {
			description: '取得網頁 cookie, 判斷 cookie 是否過期，如果過期，就需要回傳新的 cookie',
			summary: '取得網頁 cookie, 判斷 cookie 是否過期，如果過期，就需要回傳新的 cookie',
			params:{},
			security: [{ bearerAuth: [] }],
		};

		type ResponseType = {
			access_token: 	string;
			login_time: 	number;
			expired_time: 	number;
			is_login:		boolean;
		};
		fastify.get('/session', {schema}, async(req, res)=>{
			console.log(req.session.token);
			
			if (!req.session.is_login) return res.errorHandler( BaseError.UNAUTHORIZED_ACCESS );
			

			const token = req.session.token!;
			const raw_token:string = req.session.raw_token!;
				

			const result:ResponseType = {
				access_token: 	raw_token,
				login_time: 	token.iat,
				expired_time: 	token.exp,
				is_login:	 	req.session.is_login,
			};

			res.status(200).send(result);
		});
	}
	/** GET /auth/login */
	{
		const schema = {
			description: '取得驗證碼',
			summary: '取得驗證碼',
			params:{},
		};
		fastify.get<{Reply:APIResponse<{image:string}>}>('/login', {schema}, async (req, res) => {
			// Generate a new CAPTCHA	
			const options = {
				size: 6,
				noise: 2,
				color: false,
				//background: '#f0f0f0',//background: '#f0f0f0',
				charPreset: '0123456789', // This includes only numeric characters
			  };
			  const captcha = svgCaptcha_create(options);
	

			// Store the CAPTCHA text in a session or database for verification
			const cid = TrimId.NEW.toString(32);
			const captchaText = captcha.text;
			console.log({captchaText});
			

			await Postgres.query(`INSERT INTO captchas(cid, captcha_text) VALUES ($1, $2);`, [cid, captchaText]);
		  

			// Render the login form with the CAPTCHA image
			const loginForm = `<img src="data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}" alt="Captcha" />`;
		  
			res.status(200).send({image:loginForm});
		  });
	}
	/** POST /auth/login
	 *	- 登入
	**/
	{
		const schema = {
			description: '使用手機號碼和密碼登入',
			summary: '使用手機號碼和密碼登入',
			body: {
				type: 'object',
                properties: {
					mobile_number:  { type: 'string' },
                    password: 		{ type: 'string' },
					captcha:  		{ type: 'string' },
				},
				examples: [{
					mobile_number: '0933111111',
					password: 'A1234567',
					captcha: '123456'
				}]
			}
		};


		type ResponseType = {
			access_token:string;
			expired_time:epoch;
			login_time:epoch;
		};

		fastify.post<{Body:{mobile_number:User['contact_mobile_number'], password:User['password'], captcha:string}, Reply:APIResponse<ResponseType>}>('/login', {schema}, async(req, res)=>{
			const {mobile_number, password, captcha} = req.body;
			
			
			{
				if ( mobile_number === undefined ) {
					return res.errorHandler(LoginError.MOBILE_NUMBER_REQUIRED);
				}

				if ( password === undefined ) {
					return res.errorHandler(LoginError.PASSWORD_REQUIRED);
				}

				if ( captcha === undefined ) {
					return res.errorHandler(LoginError.CAPTCHA_REQUIRED);
				}
				
			}
			// NOTE: check captcha
			{
				const {rows:[row]} = await Postgres.query(`SELECT * FROM captchas WHERE captcha_text = $1 AND NOW() <= to_timestamp(expired_time);`, [captcha])
				if (row === undefined) {
					return res.errorHandler(LoginError.CAPTCHA_INVALID);
				}
			}
			// NOTE: check nid and password
			let user_id:string, user_role:number;
			{
				try {
					const {rows:[USER]} = await Postgres.query<{nid:User['nid'],  uid:User['uid'], role:User['role']}>(`SELECT nid, uid, role FROM users WHERE contact_mobile_number=$1;`, [mobile_number]);
					if (USER === undefined) {
						return res.errorHandler( LoginError.INVALID_ACCOUNT_OR_PASSWORD );
					}
					// NOTE: verify user password
					const {rows:[IS_VALID]} = await Postgres.query<{uid:User['uid'], role:User['role']}>(`SELECT (verify_password($1, $2)).*;`, [USER.nid, password]);				
					if (IS_VALID === undefined) {
						return res.errorHandler( UserError.INVALID_PASSWORD );
					}
					if (USER.uid !== IS_VALID.uid && USER.role !== IS_VALID.role)  {
						return res.errorHandler( LoginError.INVALID_ACCOUNT_OR_PASSWORD );
					}

					user_id   = USER.uid;
					user_role = USER.role;
				} catch (error) {
					return res.errorHandler( UserError.INVALID_PASSWORD );
				}
			}
		


			// NOTE: Generate JWT Token
			const TOKEN_INFO:RoskaSessToken = {
				tid:  TrimId.NEW.toString(32),
				uid:  user_id!,
				role: user_role,
				iss:  'YK5-ROSKA',
				iat:  Date.unix(),
				exp:  Date.unix() + LOGIN_SESSION_DURATION,
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
			


			// NOTE: Query auth info for updating or Insert a new auth document
			const sql = PGDelegate.format(`INSERT INTO login_sessions(${Object.keys(AUTH_DATA)}) VALUES (${Object.keys(AUTH_DATA).map(e => `{${e}}` ).join(', ')})`, AUTH_DATA);		
			await Postgres.query(sql);

			await Postgres.query(`DELETE FROM captchas WHERE captcha_text = $1;`, [captcha]);

			const REFRESH_INFO:HuntRefreshToken = {
				tid: TOKEN_INFO.tid,
				exp: TOKEN_INFO.exp + LOGIN_SESSION_DURATION
			};
			// const refresh_token = BWT.GenBWT(REFRESH_INFO, Config.secret.session);


			res
			.header('Authorization', token)
			.setCookie(Config.cookie.cookie_session_id, token, {
				path:'/',
				httpOnly: true,
				expires:  new Date(AUTH_DATA.expired_time * 1000),
				domain:   Config.cookie.domain || undefined
			})
			.status(200)
			.send({
				access_token:  token,
				expired_time:  AUTH_DATA.expired_time,
				login_time:    AUTH_DATA.login_time
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
            params: {},
			security: [{ bearerAuth: [] }],
        };
        fastify.get('/logout', {schema}, async(req, res)=>{
            if (req.session.is_login === true) {				
                const {tid} = req.session.token!;
                const sql = PGDelegate.format(`UPDATE login_sessions SET revoked={revoked}, revoked_time=NOW() WHERE id={id};`, {id:tid, revoked:true});
                await Postgres.query(sql);
            }
			
			
            res.clearCookie(Config.cookie.cookie_session_id).status(200).send({});
        });
    }
};
