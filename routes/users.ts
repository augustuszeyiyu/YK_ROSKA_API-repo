import { FastifyInstance } 	from "fastify";
import Postgres from '/data-source/postgres.js';
import {User} from '/data-type/users.js';
import { PGDelegate } from "pgdelegate";
import { LoginError, UserError } from "/lib/error";


export = async function(fastify: FastifyInstance) {
	{
		const schema = {
			description: '取得使用者自己的資料',
			summary: '取得使用者自己的資料',
			params: {
				type: 'object',
				properties: {}
			},
			security: [{ bearerAuth: [] }],
		};

		fastify.get<{Reply:Object}>('/user', {schema}, async (req, res)=>{			
			if (req.session.is_login === false) {
				return res.errorHandler(LoginError.LOGIN_REQUIRED);
			}

			const {uid} = req.session.token!;
			

			const {rows:[row]} = await Postgres.query(`SELECT * FROM users WHERE uid=$1;`, [uid]);
			delete row.password;

			res.status(200).send(row);
		});
	}

	{
		const schema = {
			description: '修改使用者自己的資料',
			summary: '修改使用者自己的資料',
			body: {
				description: '修改使用者自己的資料',
				type: 'object',
				properties: {
					address: { type: 'string' },
					line_id: { type: 'string' },
					contact_home_number: { type: 'string' },
					contact_mobile_number: { type: 'string' },
					bank_code: { type: 'string', pattern: '^[0-9]*$' },
					branch_code: { type: 'string', pattern: '^[0-9]*$' },
					bank_account_name: { type: 'string' },
					bank_account_number: { type: 'string', pattern: '^[0-9]*$' },
					emergency_nid: { type: 'string' },
					emergency_contact: { type: 'string' },
					emergency_contact_number: { type: 'string', pattern: '^[0-9]*$' },
					emergency_contact_relation: { type: 'string' },
				}
			},
			security: [{ bearerAuth: [] }],
		};

		fastify.post<{Body:Partial<User>, Reply:Object}>('/user', {schema}, async (req, res)=>{
			if (req.session.is_login === false) {
				return res.errorHandler(LoginError.LOGIN_REQUIRED);
			}

			const {uid} = req.session.token!;

			const {rows:[row]} = await Postgres.query(`SELECT * FROM users WHERE uid=$1 AND revoked=false;`, [uid]);
			if (row === undefined) {
				return res.errorHandler(UserError.ACCOUNT_NOT_EXISTS);
			}

			const { address, line_id, contact_home_number, contact_mobile_number, bank_code, branch_code, bank_account_name, bank_account_number, 
					emergency_nid, emergency_contact, emergency_contact_number, emergency_contact_relation} = req.body;
			

			const payload:Partial<User> = {};
			{
				const Mobile_Number_Pattern = /^09\d{10}$/;
				const Main_Island_Home_Number_Pattern = /^0[2-9]-\d{7,8}$/;
				const Number_String_Pattern = /^[0-9]*\.?[0-9]+$/;


				if (address !== undefined)								{ payload.address = address; }
	
				if (line_id !== undefined)								{ payload.line_id = line_id; }
	
				if (contact_home_number !== undefined) 					{					
					if (Main_Island_Home_Number_Pattern.test(contact_home_number) === false) {
																		return res.status(400).send({msg:'連絡電話-市話格式錯誤'});
					}
					else 												{ payload.contact_home_number = contact_home_number; }
				}
				
	
				if (contact_mobile_number !== undefined)				{
					if (Mobile_Number_Pattern.test(contact_mobile_number) === false) 	{ 
																		return res.status(400).send({msg:'連絡電話-手機格式錯誤'}); 
					}
					else 												{ payload.contact_mobile_number = contact_mobile_number; }
				}
	
				if (bank_code !== undefined)							{ payload.bank_code = bank_code; }
	
				if (branch_code !== undefined)							{ payload.branch_code = branch_code; }
	
				if (bank_account_name !== undefined)					{ payload.bank_account_name = bank_account_name; }
	
				if (bank_account_number !== undefined)					{ payload.bank_account_number = bank_account_number; }
	
				if (emergency_nid !== undefined) 						{ payload.emergency_nid = emergency_nid; }

				if (emergency_contact !== undefined) 					{ payload.emergency_contact = emergency_contact; }

				if (emergency_contact_number !== undefined) 			{
					if (Main_Island_Home_Number_Pattern.test(emergency_contact_number) === false && Mobile_Number_Pattern.test(emergency_contact_number) === false) {
																		return res.status(400).send({msg:'緊急聯絡電話格式錯誤'});
					}
					else 												{ payload.emergency_contact_number = emergency_contact_number; }

					if (emergency_contact_relation === undefined) 		{ return res.status(400).send({msg:'緊急連絡關係必填'}); }
					else												{ payload.emergency_contact_relation = emergency_contact_relation; }
				}
			}

			console.log(payload);

			const update_list:string[] = [];
			for (const key in payload) {
				update_list.push( `${key} = {${key}}` );
			}
			const user_data_sql = PGDelegate.format(`
				UPDATE users SET ${update_list.join(', ')} 
				WHERE uid = {uid} 
				RETURNING *;`, Object.assign(payload, {uid}));
			console.log(user_data_sql);
			
			const {rowCount} = await Postgres.query<User>(user_data_sql);
			if (rowCount === 1)  return res.status(200).send({});
			else 				 return res.status(400).send({msg: '資料寫入失敗'});
		});
	}

	{
		const schema = {
			description: '刪除使用者資料',
			summary: '刪除使用者資料',
			params: {
				type: 'object',
				properties: {
					uid: { type: 'string' },
				}
			},
			security: [{ bearerAuth: [] }],
		};

		fastify.delete<{Params:{uid:User['uid']}, Body:Partial<User>, Reply:Object}>('/user/:uid', {schema}, async (req, res)=>{		
			const {uid} = req.params;
			const {rowCount} = await Postgres.query(`UPDATE FROM users SET revoked=true WHERE uid=$1;`, [uid]);
			if (rowCount !== 1) {
				return res.status(400).send('使用者不存在')
			}
			
			res.status(200).send({});
		});
	}
};
