import $ from "shared-storage";
import { FastifyInstance } from "fastify";

import Postgres from '/data-source/postgres.js';
import Validator from '/lib/validator.js';
import { ErrorCode } from "/lib/error-code.js";
import { UserError } from "/lib/error.js";
import { INT_POSSITIVE_STR_FORMAT } from "/data-type/common-helpers.js";
import { User } from "/data-type/users.js";



export = async function(fastify:FastifyInstance) {
	
	// GET /admin/user/list
	{
        const schema_query = {
            type: "object",
            properties: {
                filter_text: {type:"string"},
				order: {type:"string"},
				p:  { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
				ps: { type: 'string', pattern: INT_POSSITIVE_STR_FORMAT.source },
            },
        }
        const schema = {
            description: '管理者搜尋使用者列表',
			summary: '管理者搜尋使用者列表',
            querystring: schema_query,
			security: [{ bearerAuth: [] }],
        }
		const PayloadValidator = $.ajv.compile(schema_query);
		type PaginateCursorUser = PaginateCursor<{ "uid":string, "name":string, "contact_home_number":string, "contact_mobile_number":string, "create_time":number }[]>;
		fastify.get<{Querystring:{filter_text?:string, order?:string, p?:string, ps?:string}, Reply:APIResponse<PaginateCursorUser>}>('/user/list', {schema}, async (req, res) => {
			if ( !PayloadValidator(req.query) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }

			// NOTE: user admin-level = 2
			// if (req.session.admin_level! <= 1) {
            //     return res.status(400).send({
            //         scope:req.routerPath,
            //         code:ErrorCode.UNAUTHORIZED,
            //         msg: "You're not authorized to access this resource!"
            //     });
            // }


			const {filter_text, order, p, ps} = req.query;
			const _order_by = order? order.split(',') : [];
			const _PageNumber = p && parseInt(p)>0? parseInt(p) : 1;
			const _PageSize = !ps? 30 : (ps && parseInt(ps)<30? 30: (ps && parseInt(ps) > 150 ? 150 : parseInt(ps)));
  			const _PageOffset = ((_PageNumber-1) * _PageSize);


			let sql_count = `SELECT COUNT(*) `;
			let sql = `SELECT u."uid", u."name", u."contact_home_number", u."contact_mobile_number", u."create_time" FROM "users" u `;
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
			
			
			// NOTE: count total_records			
			const val_count = val;
			
			

			if (filter_text) {
				let sql_temp = '';
				sql_temp += ` WHERE (`;
				sql_temp +=	` u."name" LIKE '%${filter_text}%' `;
				sql_temp += ` OR u."uid" = '${filter_text}' `;
                sql_temp += ` OR u."contact_home_number" LIKE '${filter_text}' ) `;
                sql_temp += ` OR u."contact_mobile_number" LIKE '${filter_text}' ) `;
                sql_temp += ` ) `;
				sql += sql_temp;
				sql_count += sql_temp;
            }

			console.log(sql_count, val_count);


            const {rows} = await Postgres.query(sql_count, val_count); 
			let total_records = 0;
            if (Number(rows[0].count) > 0)  total_records = Number(rows[0].count);
            else {
                return res.status(200).send(result);
            };


			


			if (_order_by.length>0) {
				const arry:string[] = [];
				for (const elm of _order_by) {				
					
					const pre_order_by_data = elm.trim().split(':');					
					if (pre_order_by_data.length!==2) continue;

					let key = pre_order_by_data[0];


					switch (key) {
						case 'uid':
							key='u.uid';
							break;
                        case 'nid':
                            key='u.nid'
						case 'name':
							key='u.name'
                        case 'name':
                            key='u.name'
						case 'create_time':
							key='u.create_time';
							break;
						default:
							break;
					}
						
					const value = pre_order_by_data[1] && ['ASC', 'DESC'].includes(pre_order_by_data[1].toUpperCase())? pre_order_by_data[1].toUpperCase(): undefined;
					
					if(key && value) arry.push(` ${key} ${value} `);
				}
                if (order?.indexOf('uid') === -1) arry.push(` u.uid DESC `);
                
                sql += ` ORDER BY ${arry.join(',')}`;
			}
			else {
				sql += ` ORDER BY u.uid DESC `;
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
    // GET api/admin/user/:uid
	{
        const schema_params = {
            type: "object",
            properties: {
                uid: {type:"string"},
            },
			required:["user_id"]
        };
        const schema = {
            description: '管理者搜尋使用者個人資料',
			summary: '管理者搜尋使用者個人資料',
            params: schema_params,
			security: [{ bearerAuth: [] }],
        }
		const PayloadValidator = $.ajv.compile(schema_params);
		type ResponseUser= User & {};
		fastify.get<{Params:{uid:string}, Reply:APIResponse<ResponseUser>}>('/user/:uid', {schema}, async(req, res)=>{
			if ( !PayloadValidator(req.params) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }


			// NOTE: user admin-level = 2			
			// if (req.session.admin_level! <= 1) {
            //     return res.status(400).send({
            //         scope:req.routerPath,
            //         code:ErrorCode.UNAUTHORIZED,
            //         msg: "You're not authorized to access this resource!"
            //     });
            // }          


			const {uid} = req.params;
			if (!uid || uid.trim() === '') {
				return res.status(400).send({
                    scope:req.routerPath,
                    code:ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "uid cannot be empty"
                });
			}
			

           const {rows:[row]} = await Postgres.query(`SELECT * FROM users WHERE uid=$1;`, [uid]);


			res.status(200).send(row);
		});
	}
	// POST /admin/user/:uid
	{
        const schema_params = {
            type: "object",
            properties: {
                uid:                        {type:"string"},       
            }
        };
        const schema_body= {
            type: "object",
            properties: {
                uid: 						{type:"string"},
				name:						{type:"string"},
				password:					{type:"string"},
                contact_home_number:        {type:"string"},
                contact_mobile_number:      {type:"string"},
                address:                    {type:"string"},
                role:                       {type:"number"},
            },
			required:["uid"]
        }
        const schema = {
			description: '管理者修改使用者資料',
			summary: '管理者修改使用者資料',
            params: schema_params,
            body: schema_body,
			security: [{ bearerAuth: [] }],
		};
        const PayloadValidator1 = $.ajv.compile(schema_params);
		const PayloadValidator2 = $.ajv.compile(schema_body);
		type PayloadBody = {
			uid:string, 
			name:string,
			password:string,
            contact_home_number:string,
            contact_mobile_number:string,
            address:string,
            role:number,
        };
		fastify.post<{Params:{uid:User['uid']}, Body:PayloadBody, Reply:object}>('/user/:uid', {schema}, async(req, res)=>{
            if ( !PayloadValidator1(req.params) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator1.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }
			
			if ( !PayloadValidator2(req.body) ) {
                return res.status(400).send({
                    scope:req.routerPath,
                    code: ErrorCode.INVALID_REQUEST_PAYLOAD,
                    msg: "Request payload is invalid!",
                    detail: PayloadValidator2.errors!.map(e=>`${e.instancePath||'Payload'} ${e.message!}`)
                });
            }
			

			// NOTE: user admin-level > 3
			// if (req.session.admin_level! <= 3) {
            //     return res.status(400).send({
            //         scope:req.routerPath,
            //         code:ErrorCode.UNAUTHORIZED,
            //         msg: "You're not authorized to access this resource!"
            //     });
            // }


            const uid = req.params.uid;
			const payload = req.body;
            const update_list:Partial<PayloadBody> = {};
			

			// NOTE: check value is valid or not.
			{
				const {rows:[user_info]} = await Postgres.query<User>(`SELECT * FROM users where uid=$1`, [uid]);
				if (!user_info) 		 { return res.errorHandler(UserError.USER_NOT_EXISTS, [payload.uid]); }

				if (payload.name !== undefined && user_info.name !== payload.name) {
                    update_list.name = payload.name;
				}

				if (payload.password !== undefined) {
					if ( Validator.checkPasswordFormat(payload.password) )  {
						update_list.password = payload.password;
						await Postgres.query<User>(`UPDATE login_sessions SET revoked=true, revoked_time=extract(epoch from NOW()) where uid=$1`, [payload.uid]);
					}
					else return res.errorHandler( UserError.INVALID_PASSWORD_FORMAT );
				}
				
				
				if (payload.contact_home_number !== undefined) 	{
					update_list.contact_home_number = payload.contact_home_number;
				}

				if (payload.contact_mobile_number !== undefined) 	{
					update_list.contact_mobile_number = payload.contact_mobile_number;
				}

				if (payload.address !== undefined) {
					update_list.address = payload.address;
				}

                if (payload.role !== undefined) {
                    update_list.role = payload.role;
                };
            }

			// UPDATE users
			if (Object.keys(update_list).length > 0) {
				console.log('prepare update user:', update_list);
				
                const update_data:string[] = [];
                for (const key in update_list) {
                    update_data.push(`${key} = ${update_list[key]}`)
                }
				await Postgres.query(`UPDATE users SET ${update_data.join(', ')} WHERE uid = $1;`, [uid])
			}


			res.status(200).send({});	
		});
	}
}