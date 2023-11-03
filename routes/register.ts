import { FastifyInstance } 	from "fastify";
import {PGDelegate} from "pgdelegate";
import TrimId from "trimid";

import Postgres from '/data-source/postgres.js';
import {User, User_Registr, isValidNewResidentID, isValidPassword, isValidTaiwanNationalID} from '/data-type/users.js';


export = async function(fastify: FastifyInstance) {
	/** /api/version **/
	{
		const schema = {
			description: '註冊新帳號',
			summary: '註冊新帳號',
			body: {
				description: '註冊新帳號',
				type: 'object',
				properties: {
					nid: { type: 'string' },
					name: { type: 'string' },
					gender: { type: 'string' },
					birth_date: { type: 'string' },
					address: { type: 'string' },
					line_id: { type: 'string' },
					contact_home_number: { type: 'string', pattern: '^[0-9]*$' },
					contact_mobile_number: { type: 'string', pattern: '^[0-9]*$' },
					bank_code: { type: 'string', pattern: '^[0-9]*$' },
					branch_code: { type: 'string', pattern: '^[0-9]*$' },
					bank_account_name: { type: 'string' },
					bank_account_number: { type: 'string', pattern: '^[0-9]*$' },
					emergency_nid: { type: 'string' },
					emergency_contact: { type: 'string' },
					emergency_contact_number: { type: 'string', pattern: '^[0-9]*$' },
					emergency_contact_relation: { type: 'string' },
					password: { type: 'string' },
					referrer_nid: { type: 'string' },
					volunteer_nid: { type: 'string' }
				},
				required: [ 'nid', 'name', 'gender', 'birth_date', 'contact_mobile_number', 'password',
							'bank_code', 'branch_code',  'bank_account_name', 'bank_account_number', 
							'emergency_nid', 'emergency_contact', 'emergency_contact_number', 'emergency_contact_relation' ],
				examples: [{
					"nid": "A112345555",
					"name": "王曉明",
					"gender": "M",
					"birth_date": "1930-08-28",
					"address": "台北市北投區光明路二段二樓",
					"line_id": "Richard",
					"contact_home_number": "0228233333",
					"contact_mobile_number": "0933111111",
					"bank_code": "004",
					"branch_code": "02135",
					"bank_account_name": "王曉明",
					"bank_account_number": "202342414432400",
					"emergency_nid": "B123456789",
					"emergency_contact": "王大明",
					"emergency_contact_number": "0935088881",
					"emergency_contact_relation": "父子",
					"password": "Abcd1234"
				}]
			},
			
		};

		fastify.post<{Body:User_Registr}>('/register', {schema}, async (req, res)=>{
			const body = req.body;
			console.log(body);
			
			const { nid, name, gender, birth_date, address, line_id, contact_home_number, contact_mobile_number, 
					bank_code, branch_code, bank_account_name, bank_account_number,
					emergency_nid, emergency_contact, emergency_contact_number, emergency_contact_relation,
					referrer_nid, volunteer_nid, password } = body;
			

			const payload:Partial<User> = {	uid: TrimId.NEW.toString(32) };


			// handle column errors
			{
				const birth_date_pattern = /^\d{4}-\d{2}-\d{2}$/;
				const Mobile_Number_Pattern = /^09\d{10}$/;
				const Main_Island_Home_Number_Pattern = /^0[2-9]\d{7,8}$/;

				console.log(Main_Island_Home_Number_Pattern.test(contact_home_number));
				console.log(Mobile_Number_Pattern.test(contact_mobile_number));


				if (nid === undefined) 		{ return res.status(400).send({msg:'身分證字號必填'}); }
				else						{ 
					{ payload.nid = nid;  }
					// const {rows:[row]} = await Postgres.query('SELECT * FROM users WHERE nid=$1;', [nid]);
					// if (row) 				{ return res.status(400).send({msg:'該身分證字號已被註冊'}); }
					// else 
					// if (isValidTaiwanNationalID(nid)=== false || isValidNewResidentID(nid) === false) {
					// 						return res.status(400).send({msg:'該身分證字號錯誤'});	
					// }
					// else 					
				}
				
				if (name === undefined)		{ return res.status(400).send({msg:'姓名必填'}); }
				else						{ payload.name = name; }

				if (password === undefined)	{ return res.status(400).send({msg:'密碼必填'}); }
				else
				if (isValidPassword(password) === false) 
											{ return res.status(400).send({msg:'密碼錯誤'}); }
				else						{ payload.password = password; }

				if (gender === undefined)	{ return res.status(400).send({msg:'性別必填'}); }
				else						{ payload.gender = gender; }

				if (address === undefined)	{ return res.status(400).send({msg:'性別必填'}); }
				else						{ payload.address = address; }

				if (line_id !== undefined)	{ payload.line_id = line_id; }

				if (birth_date === undefined)							{ return res.status(400).send({msg:'生日必填'}); }
				else
				if (birth_date_pattern.test(birth_date) === false) 		{ return res.status(400).send({msg:'生日日期格式錯誤'});}
				else													{ payload.birth_date = birth_date; }

				if (contact_home_number !== undefined && Main_Island_Home_Number_Pattern.test(contact_home_number) === false) {
					return res.status(400).send({msg:'連絡電話-市話格式錯誤'});
				}
				else 													{ payload.contact_home_number = contact_home_number.replace(/(\d{2})(\d{3,4})(\d{3})/, '$1-$2-$3'); }

				if (contact_mobile_number === undefined)				{ return res.status(400).send({msg:'生日必填'}); }
				if (Mobile_Number_Pattern.test(contact_mobile_number)) 	{ return res.status(400).send({msg:'連絡電話-手機格式錯誤'}); }
				else 													{ payload.contact_mobile_number = contact_mobile_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3'); }

				if (bank_code === undefined)							{ return res.status(400).send({msg:'銀行代號必填'}); }
				else													{ payload.bank_code = bank_code; }

				if (branch_code === undefined)							{ return res.status(400).send({msg:'銀行分行代號必填'}); }
				else													{ payload.branch_code = branch_code; }

				if (bank_account_name === undefined)					{ return res.status(400).send({msg:'銀行帳號用戶名必填'}); }
				else													{ payload.bank_account_name = bank_account_name; }

				if (bank_account_number === undefined)					{ return res.status(400).send({msg:'銀行帳號必填'}); }
				else													{ payload.bank_account_number = bank_account_number; }

				if (emergency_nid === undefined)						{ return res.status(400).send({msg:'緊急連絡人身分證字號必填'}); }
				else													{ payload.emergency_nid = emergency_nid; }

				if (emergency_contact === undefined) 					{ return res.status(400).send({msg:'緊急連絡人必填'}); }
				else 													{ payload.emergency_contact = emergency_contact; }

				if (emergency_contact_number === undefined) 			{ return res.status(400).send({msg:'緊急連絡電話必填'}); }
				else
				if (Main_Island_Home_Number_Pattern.test(emergency_contact_number) === false && Mobile_Number_Pattern.test(emergency_contact_number) === false) {
																		return res.status(400).send({msg:'緊急聯絡電話格式錯誤'});
				}
				else 													{ payload.emergency_contact_number = emergency_contact_number; }

				if (emergency_contact_relation === undefined) 			{ return res.status(400).send({msg:'緊急連絡關係必填'}); }
				else													{ payload.emergency_contact_relation = emergency_contact_relation; }


				if (referrer_nid !== undefined) 						{ 
					const {rows:[row]} = await Postgres.query('SELECT * FROM users WHERE nid=$1;', [referrer_nid]);
					if (row === undefined) 								{ return res.status(400).send({msg:'系統查無此人，請先註冊'}); }
					else 												{ payload.referrer_uid = row.uid; }
				}

				if (volunteer_nid !== undefined)						{ 
					const {rows:[row]} = await Postgres.query('SELECT * FROM users WHERE nid=$1;', [volunteer_nid]);
					if (row === undefined) 								{ return res.status(400).send({msg:'系統查無此人，請先註冊'}); }
					else 												{ payload.volunteer_uid = row.uid; }
				}
			}

			
		

			console.log(payload);			
			const user_data_sql = PGDelegate.format(`
				INSERT INTO users (${Object.keys(payload).join(', ')})
				VALUES (${Object.keys(payload).map(e => `{${e}}` ).join(', ')}) 
				RETURNING *;`, payload);
			console.log(user_data_sql);
			
			const {rowCount} = await Postgres.query<User>(user_data_sql);
			if (rowCount === 1)  return res.status(200).send({});
			else 				 return res.status(400).send({msg: '資料寫入失敗'});
		});
	}
};
