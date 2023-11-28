import $ from 'shared-storage';
import TrimId from "trimid";
import { FastifyInstance } 	from "fastify";
import {PGDelegate} from "pgdelegate";
import * as TaiwanIdValidator from 'taiwan-id-validator';

import Postgres from '/data-source/postgres.js';
import {User, User_Registr, isValidPassword} from '/data-type/users.js';
import { BaseError, UserError } from "/lib/error";
import { ErrorCode } from '/lib/error-code';


export = async function(fastify: FastifyInstance) {
	/** /api/register **/
	{
		const schema_body = {
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
						'emergency_nid', 'emergency_contact', 'emergency_contact_number', 'emergency_contact_relation' ]
		}
		const schema = {
			description: '註冊新帳號',
			summary: '註冊新帳號',
			body: Object.assign(schema_body,{
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
			}),
		};
		fastify.post<{Body:User_Registr}>('/register', {schema}, async (req, res)=>{			
			const { nid, name, gender, birth_date, address, line_id, contact_home_number, contact_mobile_number, 
					bank_code, branch_code, bank_account_name, bank_account_number,
					emergency_nid, emergency_contact, emergency_contact_number, emergency_contact_relation,
					referrer_nid, volunteer_nid, password } = req.body;
			

			const payload:Partial<User> = {	uid: TrimId.NEW.toString(32) };


			// handle column errors
			{
				const birth_date_pattern = /^\d{4}-\d{2}-\d{2}$/;
				const Mobile_Number_Pattern = /^09\d{10}$/;
				const Main_Island_Home_Number_Pattern = /^0[2-9]\d{7,8}$/;

				console.log(Main_Island_Home_Number_Pattern.test(contact_home_number));
				console.log(Mobile_Number_Pattern.test(contact_mobile_number));


				if (nid === undefined) 		{ return res.errorHandler(UserError.NID_IS_REQUIRED); }
				else						{ 
					const {rows:[row]} = await Postgres.query<User>(`SELECT * FROM users WHERE nid=$1;`, [nid]);
					if (row !== undefined)  return res.errorHandler(UserError.NID_IS_EXISTS);
					
					payload.nid = nid; 
				}  
	
				
				if (name === undefined)		{ return res.errorHandler(UserError.NAME_IS_REQUIRED); }
				else						{ payload.name = name; }

				if (password === undefined)	{ return res.errorHandler(UserError.PASSWORD_IS_REQUIRED); }
				else
				if (isValidPassword(password) === false) 
											{ return res.errorHandler(UserError.INVALID_PASSWORD); }
				else						{ payload.password = password; }

				if (gender === undefined)	{ return res.errorHandler(UserError.GENDER_IS_REQUIRED); }
				else						{ payload.gender = gender; }

				if (address === undefined)	{ return res.errorHandler(UserError.ADDRESS_IS_REQUIRED); }
				else						{ payload.address = address; }

				if (line_id !== '' && line_id !== undefined)	{ payload.line_id = line_id; }

				if (birth_date === undefined)							{ return res.errorHandler(UserError.DOB_IS_REQUIRED); }
				else
				if (birth_date_pattern.test(birth_date) === false) 		{ return res.errorHandler(UserError.DOB_FORMAT_INVALID); }
				else													{ payload.birth_date = birth_date; }

				if (contact_home_number !== undefined && Main_Island_Home_Number_Pattern.test(contact_home_number) === false) {
					return res.errorHandler(UserError.HOME_PHONE_FORMAT_INVALID);
				}
				else 													{ payload.contact_home_number = contact_home_number.replace(/(\d{2})(\d{3,4})(\d{3})/, '$1-$2-$3'); }

				if (contact_mobile_number === undefined)				{ return res.errorHandler(UserError.MOBILE_PHONE_IS_REQUIRED); }
				if (Mobile_Number_Pattern.test(contact_mobile_number)) 	{ return res.errorHandler(UserError.MOBILE_PHONE_FORMAT_INVALID); }
				else 													{ payload.contact_mobile_number = contact_mobile_number.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3'); }

				if (bank_code === undefined)							{ return res.errorHandler(UserError.BANK_CODE_IS_REQUIRED); }
				else													{ payload.bank_code = bank_code; }

				if (branch_code === undefined)							{ return res.errorHandler(UserError.BRANCH_CODE_IS_REQUIRED); }
				else													{ payload.branch_code = branch_code; }

				if (bank_account_name === undefined)					{ return res.errorHandler(UserError.BANK_ACCOUNT_NAME_IS_REQUIRED);; }
				else													{ payload.bank_account_name = bank_account_name; }

				if (bank_account_number === undefined)					{ return res.errorHandler(UserError.BANK_ACCOUNT_NUMBER_IS_REQUIRED); }
				else													{ payload.bank_account_number = bank_account_number; }

				if (emergency_nid === undefined)						{ return res.errorHandler(UserError.EMERGENCY_NID_IS_REQUIRED); }
				else													{ payload.emergency_nid = emergency_nid; }

				if (emergency_contact === undefined) 					{ return res.errorHandler(UserError.EMERGENCY_CONTACT_IS_REQUIRED); }
				else 													{ payload.emergency_contact = emergency_contact; }

				if (emergency_contact_number === undefined) 			{ return res.errorHandler(UserError.EMERGENCY_CONTACT_NUMBER_IS_REQUIRED); }
				else
				if (Main_Island_Home_Number_Pattern.test(emergency_contact_number) === false && Mobile_Number_Pattern.test(emergency_contact_number) === false) {
																		return res.errorHandler(UserError.EMERGENCY_CONTACT_NUMBER_FORMAT_INVALID);
				}
				else 													{ payload.emergency_contact_number = emergency_contact_number; }

				if (emergency_contact_relation === undefined) 			{ return res.errorHandler(UserError.EMERGENCY_CONTACT_IS_REQUIRED); }
				else													{ payload.emergency_contact_relation = emergency_contact_relation; }


				if (referrer_nid !== undefined) 						{ 
					const {rows:[row]} = await Postgres.query('SELECT * FROM users WHERE nid=$1;', [referrer_nid]);
					if (row === undefined) 								{ return res.errorHandler(UserError.USER_NOT_EXISTS); }
					else 												{ payload.referrer_uid = row.uid; }
				}

				if (volunteer_nid !== undefined)						{ 
					const {rows:[row]} = await Postgres.query('SELECT * FROM users WHERE nid=$1;', [volunteer_nid]);
					if (row === undefined) 								{ return res.errorHandler(UserError.USER_NOT_EXISTS); }
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
			else 				 return res.errorHandler(BaseError.DB_INSERTION_FAILURE);
			
		});
	}
};
